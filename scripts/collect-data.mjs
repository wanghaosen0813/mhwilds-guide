import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Public, factual game data only. Reference-site scripts and advertisements are never run.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://mhwilds.gamertw.com';
const BASE = `${ORIGIN}/zh-CN`;
const CHECKED = '2026-11-13';
const CACHE = path.join(ROOT, 'data', '.collection-cache');
const ASSETS = path.join(ROOT, 'public', 'assets');
await fs.mkdir(CACHE, { recursive: true });
await fs.mkdir(ASSETS, { recursive: true });
const errors = [];
const assets = new Map();
const dictionaries = {};
const enSlug = name => String(name).toLowerCase().replace(/α/g, 'alpha').replace(/β/g, 'beta').replace(/γ/g, 'gamma').replace(/\+/g, '-plus').replace(/&/g, ' ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pageSlug = name => String(name).toLowerCase().replace(/ & /g, '-').replace(/\./g, '').replace(/ /g, '-');
const typeSlug = name => ({ 'Sword & Shield': 'sword-shield' }[name] || enSlug(name));
const recordId = name => enSlug(name);
const clean = value => typeof value === 'string' ? value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim() : value;

async function pool(list, task, limit = 5) {
  let next = 0;
  const output = new Array(list.length);
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) { const i = next++; output[i] = await task(list[i], i); }
  }));
  return output;
}
async function fetchResource(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'MHWildsGuideDataCollector/1.0 (public game facts; 5 concurrent requests)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) { if (attempt === 2) throw new Error(`${url}: ${error.message}`); }
  }
}
function absorb(props) {
  const lang = props?._nextI18Next?.initialI18nStore?.['zh-CN'] || {};
  for (const [namespace, values] of Object.entries(lang)) dictionaries[namespace] = { ...dictionaries[namespace], ...values };
}
function translate(value, namespace = '') {
  if (value == null || value === '') return value;
  const factualLabels = { Stomach: '腹部', 'Mining Outcrop': '矿脉', Bonepile: '骨冢' };
  return clean(dictionaries[namespace]?.[value] || dictionaries.common?.[value] || factualLabels[value] || value);
}
async function page(route) {
  const key = route.replaceAll('/', '--');
  const cachePath = path.join(CACHE, `${key}.json`);
  let result;
  try { result = JSON.parse(await fs.readFile(cachePath, 'utf8')); }
  catch {
    let html;
    const localName = route === 'monster/arkveld' ? 'monster-arkveld' : route;
    if (!localName.includes('/')) {
      try { html = await fs.readFile(path.join(ROOT, 'research', 'pages', `${localName}.html`), 'utf8'); } catch { /* First collection fetches public page. */ }
    }
    if (!html) html = await (await fetchResource(`${BASE}/${route}`)).text();
    const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!json) throw new Error(`Missing public structured data: ${route}`);
    const data = JSON.parse(json);
    const props = data.props.pageProps;
    // Save only Next data and image URLs, never the reference site's advertising tags.
    result = { props, images: [...html.matchAll(/<img[^>]+src="([^\"]+)"/g)].map(match => match[1]), route, buildId: data.buildId };
    await fs.writeFile(cachePath, JSON.stringify(result));
  }
  absorb(result.props);
  return result;
}
function asset(remotePath, folder, preferredName) {
  if (!remotePath || !remotePath.startsWith('/')) return null;
  const original = new URL(remotePath, ORIGIN).href;
  if (assets.has(original)) return assets.get(original).local;
  const name = preferredName || path.posix.basename(remotePath);
  const local = `/assets/${folder}/${name}`;
  assets.set(original, { original, local, rightsHolder: 'CAPCOM CO., LTD.', usage: 'Game reference illustration; original rights remain with CAPCOM and relevant rights holders.' });
  return local;
}
const material = (name, quantity, icon) => ({ id: recordId(name), name: translate(name, 'item'), nameEn: name, quantity, image: asset(icon, 'items') });
const skillRef = (name, level) => ({ id: recordId(name), name: translate(name, 'skill'), nameEn: name, ...(level == null ? {} : { level }) });
const ratingKeys = ['sever', 'blunt', 'shot', 'fire', 'water', 'thunder', 'ice', 'dragon'];
const elements = ['fire', 'water', 'thunder', 'ice', 'dragon'];
const statuses = ['poison', 'sleep', 'paralysis', 'blast', 'stun', 'exhaust'];
const mapObject = (keys, values = []) => Object.fromEntries(keys.map((key, index) => [key, values[index] ?? null]));
const indexes = Object.fromEntries(await pool(['monster', 'weapon', 'armor', 'item', 'skill', 'pop-up-camp'], async name => [name, await page(name)]));
// These URLs were observed in the reference map's own static chunk manifest.
// Read literals as data; never evaluate downloaded JavaScript.
async function textCache(filename, url) {
  const target = path.join(CACHE, filename);
  try { return await fs.readFile(target, 'utf8'); }
  catch { const text = await (await fetchResource(url)).text(); await fs.writeFile(target, text); return text; }
}
function readLiteral(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing map data marker ${marker}`);
  let start = markerIndex + marker.length;
  while (/\s/.test(text[start])) start++;
  let depth = 0, inString = false, escaped = false, end = start;
  for (; end < text.length; end++) {
    const char = text[end];
    if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') { if (--depth === 0) { end++; break; } }
  }
  const literal = text.slice(start, end);
  let json = '', i = 0, previous = '';
  while (i < literal.length) {
    const char = literal[i];
    if (char === '"') {
      let j = i + 1;
      for (; j < literal.length; j++) { if (literal[j] === '\\') j++; else if (literal[j] === '"') { j++; break; } }
      json += literal.slice(i, j); i = j; previous = '"'; continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const word = literal.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];
      const next = literal.slice(i + word.length).match(/^\s*(.)/)?.[1];
      json += (previous === '{' || previous === ',') && next === ':' ? JSON.stringify(word) : word;
      i += word.length; previous = word.at(-1); continue;
    }
    json += char; i++; if (!/\s/.test(char)) previous = char;
  }
  return JSON.parse(json);
}
const mapEngine = await textCache('map-engine-observed.txt', `${ORIGIN}/_next/static/chunks/544.92780c20809853e9.js`);
const mapConfig = await textCache('5357-b4d1503174ed58d5.js', `${ORIGIN}/_next/static/chunks/5357-b4d1503174ed58d5.js`);
const rawMapPoints = readLiteral(mapEngine, 'let p=');
const campSafety = readLiteral(mapConfig, 'campSafetyLevel:');
const mapCategories = readLiteral(mapConfig, 'categories:');
const pointIcons = Object.fromEntries(mapCategories.flatMap(category => category.list.map(row => [row.english, row.image])));
console.log('Index pages ready. Fetching monster and armor detail data.');
const monsterPages = await pool(indexes.monster.props.monsters, async row => {
  const slug = pageSlug(row.name);
  try { return { row, slug, page: await page(`monster/${slug}`) }; }
  catch (error) { errors.push({ category: 'monster', name: row.name, error: error.message }); return { row, slug, page: null }; }
});
const armorPages = await pool(indexes.armor.props.initialSeries, async row => {
  const slug = pageSlug(row.Name);
  try { return { row, slug, page: await page(`armor/${slug}`) }; }
  catch (error) { errors.push({ category: 'armor', name: row.Name, error: error.message }); return { row, slug, page: null }; }
});
console.log(`Detail pages ready: ${monsterPages.filter(x => x.page).length} monster, ${armorPages.filter(x => x.page).length} armor sets.`);

const dropTypes = {
  Carving: '剥取', 'Carving (Rotten Monster Carcass)': '腐烂尸体剥取', 'Carving (Severed Part)': '断落部位剥取',
  'Carving (Rotten Severed Part)': '腐烂断落部位剥取', 'Broken Part Rewards': '部位破坏报酬',
  'Wound Destroyed Reward': '伤口破坏报酬', 'Target Rewards': '目标报酬',
  'Tempered Wound Destroyed Reward': '历战伤口破坏报酬', 'Carve (Crystalized Carcass)': '结晶尸体剥取',
  'Gathered with Slinger': '投射器采集', 'Unique Acquisition?': '特殊获取（参考资料未确认）',
  '???': '获取途径未确认', 'Endemic Life Catch': '环境生物捕获'
};
const monsters = monsterPages.map(({ row, slug, page: detail }) => {
  const props = detail?.props || {};
  const monster = props.monster || row;
  const weakness = props.weaknesses || row.weakness || {};
  const picture = detail?.images.find(src => src.startsWith('/monsters2/'));
  return {
    id: slug, slug, name: translate(row.name, 'monster'), nameEn: row.name,
    image: asset(picture, 'monsters', `${slug}${path.posix.extname(picture || '.png')}`), source: `${BASE}/monster/${slug}`,
    species: translate(monster.species, 'monster') || null,
    elements: mapObject(elements, monster.monsterWeakness || row.monsterWeakness),
    weaknesses: (monster.weaknesses || []).map(value => translate(value, 'monster')),
    specialAttacks: (monster.specialAttacks || []).map(value => translate(value, 'monster')),
    weakParts: (weakness.weaknessParts || []).map(value => translate(value, 'monster')),
    breakableParts: (weakness.breakableParts || []).map(value => translate(value, 'monster')),
    hitzones: Object.entries(weakness.hitzones || {}).map(([part, values]) => ({ part: translate(part, 'monster'), partEn: part, ratings: mapObject(ratingKeys, values) })),
    status: mapObject(statuses, weakness.status),
    itemEffects: Object.entries(weakness.items || {}).map(([name, value]) => ({ name: translate(name, 'item'), nameEn: name, effective: value === 'TBD' ? null : Boolean(value) })),
    crownSize: monster.crownSize?.some(value => value > 0) ? monster.crownSize : null,
    drops: (props.drops || []).map(drop => ({ itemId: recordId(drop.name), name: translate(drop.name, 'item'), nameEn: drop.name, rank: drop.rank, type: dropTypes[drop.type] || translate(drop.type, 'monster'), typeEn: drop.type, probability: drop.probability, quantity: drop.number })),
    detailAvailable: !!detail,
    dataNotes: [ ...(!(props.drops || []).length ? ['参考资料尚未提供掉落表。'] : []), ...(monster.crownSize?.every(value => value === 0) ? ['参考资料的冠尺寸为占位值，已按未知处理。'] : []) ]
  };
});

const typeNames = { 'Great Sword': '大剑', 'Long Sword': '太刀', 'Sword & Shield': '单手剑', 'Dual Blades': '双剑', Hammer: '大锤', 'Hunting Horn': '狩猎笛', Lance: '长枪', Gunlance: '铳枪', 'Switch Axe': '斩斧', 'Charge Blade': '盾斧', 'Insect Glaive': '操虫棍', Bow: '弓', 'Light Bowgun': '轻弩炮', 'Heavy Bowgun': '重弩炮' };
const weaponTypes = Object.entries(typeNames).map(([name, localized]) => ({ id: typeSlug(name), slug: typeSlug(name), name: localized, nameEn: name, count: indexes.weapon.props.weaponMap[name]?.length || 0, image: asset(indexes.weapon.props.weaponMap[name]?.[0]?.icon, 'weapons'), source: `${BASE}/weapon/${typeSlug(name)}` }));
const uniqueWeaponIds = new Map();
const weapons = Object.values(indexes.weapon.props.weaponMap).flat().map(row => {
  const basicId = recordId(row.name);
  const count = (uniqueWeaponIds.get(basicId) || 0) + 1;
  uniqueWeaponIds.set(basicId, count);
  const id = basicId + (count > 1 ? `-variant-${count}` : '');
  return {
    id, slug: id, name: translate(row.name, 'weapon'), nameEn: row.name,
    type: typeSlug(row.type), typeName: typeNames[row.type], rarity: row.rarity, attack: row.attack, affinity: row.affinity,
    element: translate(row.element, 'monster') || null, elementKey: row.element?.toLowerCase() || null, elementAttack: row.elementAttack,
    slots: row.slots || [], skills: (row.skills || []).map(([name, level]) => skillRef(name, level)),
    materials: (row.materials || []).map(([name, quantity, icon]) => material(name, quantity, icon)),
    sharpness: row.sharpness || null, sharpnessExtension: row.sharpness1 || null, specialAmmo: row.specialAmmo || null,
    image: asset(row.icon, 'weapons'), source: `${BASE}/weapon/${typeSlug(row.type)}/${indexes.weapon.props.weaponUrlMap[row.name] || basicId}`
  };
});

const armors = [];
const armorSets = armorPages.map(({ row, slug, page: detail }) => {
  const props = detail?.props || {};
  const seriesId = recordId(row.Name);
  const source = `${BASE}/armor/${slug}`;
  const pieces = (props.armorList || []).map(piece => {
    const id = `${seriesId}-${piece.type.toLowerCase()}`;
    const materialRow = props.armorMaterialList?.find(materials => materials.name === piece.name);
    const armor = {
      id, slug: id, name: translate(piece.name, 'armor'), nameEn: piece.name,
      series: translate(row.Name, 'armor'), seriesId, rarity: row.Rarity, rank: row.Rank, type: piece.type,
      defense: piece.defense, resistances: piece.resistances, slots: piece.slots || [],
      skills: (piece.skills || []).map(value => skillRef(value.skill, value.level)),
      seriesSkills: (piece.seriesSkills || []).map(value => skillRef(value.skill)),
      materials: (materialRow?.items || []).map(value => material(value.item, value.amount, value.icon)),
      image: asset(piece.icon, 'armors'), source
    };
    armors.push(armor);
    return id;
  });
  return {
    id: seriesId, slug: seriesId, name: translate(row.Name, 'armor'), nameEn: row.Name, rarity: row.Rarity, rank: row.Rank,
    type: row.Type, price: row.Price, pieces, source, image: asset(props.armorList?.[0]?.icon, 'armors'),
    groupSkill: props.groupSkill ? skillRef(props.groupSkill) : null,
    setBonuses: (props.setBonuses || []).map(value => ({ ...skillRef(value.skill), count: value.count })), detailAvailable: !!detail
  };
});

const items = Object.entries(indexes.item.props.itemMap).filter(([name]) => name !== '---').map(([name, row]) => ({
  id: recordId(name), slug: recordId(name), name: translate(name, 'item'), nameEn: name,
  type: row.type, rarity: row.rarity, buyPrice: row.buyPrice, sellPrice: row.sellPrice, maxStack: row.maxStack,
  image: asset(indexes.item.props.itemName2IconMap[name], 'items'), source: `${BASE}/item/${pageSlug(name)}`
}));
const skills = indexes.skill.props.skills.map(row => ({
  id: recordId(row.name), slug: recordId(row.name), name: translate(row.name, 'skill'), nameEn: row.name,
  category: row.category, description: translate(row.description, 'skill'),
  levels: Array.from({ length: 6 }, (_, index) => ({ level: index + 1, effect: translate(row[`description${index + 1}`], 'skill') })).filter(row => row.effect),
  image: asset(`/skills/${row.icon}.webp`, 'skills'), source: `${BASE}/skill`
}));
const maps = [];
const camps = [];
const mapPoints = [];
const campIcon = asset('/icons/pop-up-camp.png', 'icons');
for (const [name, layers] of Object.entries(indexes['pop-up-camp'].props.locationMap)) {
  const mapId = recordId(name);
  const layerKeys = layers.map(row => row.layer).sort();
  const layerImages = Object.fromEntries(layerKeys.map(layer => [layer, asset(`/layers/${layer}.jpg`, 'maps')]));
  maps.push({ id: mapId, slug: mapId, name: translate(name, 'map'), nameEn: name, image: layerImages[layerKeys[0]], layers: layerKeys, layerImages, campCount: layers.reduce((sum, row) => sum + row.list.length, 0), source: `${BASE}/map` });
  for (const layer of layers) for (const row of layer.list) {
    const safetyKey = campSafety[name]?.[row.title]?.toLowerCase() || null;
    camps.push({ id: row.id, slug: `${mapId}-${row.id}`, name: translate(row.title, 'map'), nameEn: row.title, mapId, mapName: translate(name, 'map'), layer: layer.layer, coordinates: row.coords.map(Number), safety: { safe: '安全', insecure: '不安定', dangerous: '危险' }[safetyKey] || null, safetyKey, image: campIcon, source: `${BASE}/map?id=${row.id}` });
  }
  for (const layer of layerKeys) for (const [category, points] of Object.entries(rawMapPoints[layer] || {})) {
    for (const point of points) mapPoints.push({
      id: point.id, slug: `${mapId}-${point.id}`, name: translate(point.title || category, 'map'), nameEn: point.title || category,
      category: translate(category, 'map'), categoryEn: category, mapId, layer, coordinates: point.coords.map(Number),
      image: pointIcons[category] ? asset(`/icons/${pointIcons[category]}`, 'map-icons') : null, source: `${BASE}/map?id=${point.id}`
    });
  }
}

console.log(`Downloading ${assets.size} unique game images.`);
await pool([...assets.values()], async entry => {
  const file = path.join(ROOT, 'public', entry.local);
  try {
    try { const stat = await fs.stat(file); if (stat.size > 0) { entry.bytes = stat.size; return; } } catch { /* Not downloaded yet. */ }
    const response = await fetchResource(entry.original);
    const mime = response.headers.get('content-type') || '';
    if (!mime.startsWith('image/')) throw new Error(`Unexpected image type: ${mime}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
    entry.bytes = bytes.length;
  } catch (error) { entry.error = error.message; errors.push({ category: 'asset', source: entry.original, error: error.message }); }
}, 5);
const game = {
  schemaVersion: 1, source: `${BASE}/`, checked: CHECKED,
  snapshotNote: '参考资料快照。游戏更新可能改变数值；未知数据保留为空，不宣称与最新补丁一致。',
  ratingNote: '怪物元素与部位数值为参考资料的弱点评级，不是肉质百分比。掉落 probability 为 0 至 1 的比例，按位阶和获取途径分别记录。',
  labels: { elements, hitzones: ratingKeys, statuses, sharpness: ['red', 'orange', 'yellow', 'green', 'blue', 'white'] },
  mapCoordinateSystem: { bounds: [[0, 0], [256, 256]], order: ['y', 'x'], imageXPercent: 'x / 256 * 100', imageYPercent: '(256 - y) / 256 * 100' },
  counts: { monsters: monsters.length, weaponTypes: weaponTypes.length, weapons: weapons.length, armorSets: armorSets.length, armors: armors.length, items: items.length, skills: skills.length, maps: maps.length, camps: camps.length, mapPoints: mapPoints.length },
  monsters, weaponTypes, weapons, armorSets, armors, items, skills, maps, camps, mapPoints
};
await fs.writeFile(path.join(ROOT, 'data', 'game.json'), JSON.stringify(game, null, 2));
await fs.writeFile(path.join(ROOT, 'data', 'asset-sources.json'), JSON.stringify({ checked: CHECKED, reference: ORIGIN, note: '本地图片仅用作非官方游戏资料说明。角色、怪物、图标及相关商标属于 CAPCOM 和相关权利人；本清单记录来源，不代表已获得商业使用许可。', assets: [...assets.values()] }, null, 2));
const itemIds = new Set(items.map(row => row.id));
const uniqueIds = Object.fromEntries(['monsters', 'weaponTypes', 'weapons', 'armorSets', 'armors', 'items', 'skills', 'maps', 'camps', 'mapPoints'].map(key => [key, new Set(game[key].map(row => row.id)).size === game[key].length]));
const validation = {
  uniqueIds,
  monsterDropRows: monsters.reduce((sum, row) => sum + row.drops.length, 0),
  allDropItemsExist: monsters.every(row => row.drops.every(drop => itemIds.has(drop.itemId))),
  allCraftingItemsExist: [...weapons, ...armors].every(row => row.materials.every(item => itemIds.has(item.id))),
  allCoordinatesInBounds: mapPoints.every(row => row.coordinates.every(value => Number.isFinite(value) && value >= 0 && value <= 256)),
  allCampsHaveSafety: camps.every(row => !!row.safety),
  downloadedImages: [...assets.values()].filter(row => row.bytes > 0).length,
  totalAssetBytes: [...assets.values()].reduce((sum, row) => sum + (row.bytes || 0), 0)
};
await fs.writeFile(path.join(ROOT, 'data', 'collection-report.json'), JSON.stringify({ checked: CHECKED, counts: game.counts, images: assets.size, validation, errors }, null, 2));
console.log(JSON.stringify({ counts: game.counts, images: assets.size, errors }, null, 2));

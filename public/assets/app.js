const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage = {get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}},remove(k){try{localStorage.removeItem(k);}catch{}}};
const savedKey='wilds-saved-v1', planKey='wilds-plan-v1';
let toastTimer;
function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
$('.mobile-menu')?.addEventListener('click',e=>{const open=$('#main-nav').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',open);e.currentTarget.setAttribute('aria-label',open?'关闭导航':'展开导航');});
for(const list of $$('[data-filter-list]')){
 const rows=$$('[data-filter-item]',list), per=Number(list.dataset.pageSize||30);let page=1;
 const q=$('[data-filter-search]',list), filters=$$('[data-filter]',list);
 function render(){const term=(q?.value||'').trim().toLocaleLowerCase();const found=rows.filter(row=>(!term||(row.dataset.search||row.textContent).toLocaleLowerCase().includes(term))&&filters.every(f=>!f.value||row.dataset[f.dataset.filter]===f.value));const total=Math.max(1,Math.ceil(found.length/per));page=Math.min(page,total);const visible=new Set(found.slice((page-1)*per,page*per));for(const r of rows)r.hidden=!visible.has(r);const count=$('.result-count',list);if(count)count.textContent=`${found.length} 条资料`;const empty=$('.list-empty',list);if(empty)empty.hidden=found.length>0;const pager=$('.pagination',list);if(pager){pager.hidden=found.length<=per;$('[data-page-label]',list).textContent=`${page} / ${total}`;$('[data-page-prev]',list).disabled=page<=1;$('[data-page-next]',list).disabled=page>=total;}}
 q?.addEventListener('input',()=>{page=1;render();});filters.forEach(f=>f.addEventListener('change',()=>{page=1;render();}));
 $('[data-page-prev]',list)?.addEventListener('click',()=>{page--;render();list.scrollIntoView({block:'start'});});$('[data-page-next]',list)?.addEventListener('click',()=>{page++;render();list.scrollIntoView({block:'start'});});render();
}
let searchIndex;
async function loadIndex(){if(!searchIndex){const r=await fetch('/data/search.json');if(!r.ok)throw Error('资料暂时无法加载，请稍后重试。');searchIndex=await r.json();}return searchIndex;}
function resultsHtml(items){return items.map(x=>`<a class="search-result" href="${esc(x.url)}">${x.image?`<img src="${esc(x.image)}" alt="" loading="lazy">`:''}<span>${esc(x.name)}${x.en?`<small>${esc(x.en)}</small>`:''}</span><span class="badge">${esc(x.category||'收藏')}</span><span aria-hidden="true">↗</span></a>`).join('');}
function findItems(index,term){const q=term.trim().toLocaleLowerCase();if(!q)return [];return index.filter(x=>`${x.name} ${x.en||''}`.toLocaleLowerCase().includes(q)).sort((a,b)=>(a.name===term?-1:0)-(b.name===term?-1:0));}
const dialog=$('#search-dialog'), searchInput=$('input',dialog), quickResults=$('#quick-results');let searchRun=0;
async function searchQuick(){const run=++searchRun;const q=searchInput.value.trim();if(!q){quickResults.innerHTML='<p>输入名称，快速找到对应资料。</p>';return;}try{const items=findItems(await loadIndex(),q);if(run!==searchRun)return;quickResults.innerHTML=items.length?resultsHtml(items.slice(0,10))+`<p><a href="/search/?q=${encodeURIComponent(q)}">查看全部 ${items.length} 条结果 →</a></p>`:'<p>没有找到相符资料。试试中文全称或更短的关键词。</p>';}catch(e){quickResults.textContent=e.message;}}
function openSearch(){if(!dialog.open)dialog.showModal();searchInput.focus();}
$$('.search-open').forEach(b=>b.addEventListener('click',openSearch));$('[data-close-search]')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});searchInput.addEventListener('input',searchQuick);document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();openSearch();}});
if(document.body.dataset.page==='search'){
 const form=$('.page-search'), field=$('input',form), target=$('#page-search-results');field.value=new URLSearchParams(location.search).get('q')||'';
 async function perform(){const q=field.value.trim();if(!q){target.innerHTML='<p>输入一个名称，开始搜索。</p>';return;}target.innerHTML='<p>正在查找资料…</p>';try{const found=findItems(await loadIndex(),q);target.innerHTML=`<p>找到 ${found.length} 条与「${esc(q)}」相关的资料${found.length>150?'，以下显示前 150 条，请缩小关键词继续查找':''}。</p>`+resultsHtml(found.slice(0,150));}catch(e){target.textContent=e.message;}}
 form.addEventListener('submit',e=>{e.preventDefault();history.replaceState(null,'',`/search/?q=${encodeURIComponent(field.value.trim())}`);perform();});perform();
}
function syncSaved(){const saved=storage.get(savedKey,[]);$$('[data-save]').forEach(b=>{const exists=saved.some(x=>x.url===b.dataset.save);b.setAttribute('aria-pressed',exists);$('span',b).textContent=exists?'已收藏':'收藏资料';});}
$$('[data-save]').forEach(b=>b.addEventListener('click',()=>{let saved=storage.get(savedKey,[]);const had=saved.some(x=>x.url===b.dataset.save);saved=had?saved.filter(x=>x.url!==b.dataset.save):[...saved,{url:b.dataset.save,name:b.dataset.title}];const ok=storage.set(savedKey,saved);syncSaved();toast(ok?(had?'已取消收藏':'已保存到我的收藏'):'浏览器未允许本地保存');}));syncSaved();
if(document.body.dataset.page==='saved'){
 async function renderSaved(){const saved=storage.get(savedKey,[]);let items=saved;try{const all=await loadIndex();items=saved.map(s=>all.find(x=>x.url===s.url)||s);}catch{}$('#saved-results').innerHTML=items.length?resultsHtml(items):'<p>还没有收藏。打开任意资料或攻略页，点击「收藏资料」即可保存。</p>';$('#clear-saved').hidden=!items.length;}
 $('#clear-saved').addEventListener('click',()=>{storage.remove(savedKey);renderSaved();toast('本机收藏已清空');});renderSaved();
}
$('#clear-local-data')?.addEventListener('click',()=>{storage.remove(savedKey);storage.remove(planKey);syncSaved();toast('本站在本机保存的收藏与装备计划已删除');});
if($('[data-map]')){
 const layer=$('#map-layer'),category=$('#map-category'),zoom=$('#map-zoom');function showLayer(id){$$('.map-layer').forEach(x=>x.hidden=x.dataset.layer!==id);layer.value=id;}layer.addEventListener('change',()=>showLayer(layer.value));
 function filterPoints(){$$('[data-camp]').forEach(p=>p.hidden=p.dataset.category!==category.value);$('#map-point-count').textContent=`${$$('.camp-row').filter(p=>!p.hidden).length} 处`;$('#camp-detail').textContent=`正在查找：${category.value}。目录包含此地图各图层的位置。`;}
 category?.addEventListener('change',filterPoints);if(category)filterPoints();
 zoom?.addEventListener('input',()=>{$('.map-canvas').style.width=`${zoom.value}%`;$('#map-zoom-value').textContent=`${zoom.value}%`;});
 $$('[data-camp]').forEach(b=>b.addEventListener('click',()=>{const row=$$('.camp-row').find(r=>r.dataset.camp===b.dataset.camp);if(!row)return;showLayer(row.dataset.layer);$$('[data-camp]').forEach(x=>x.classList.toggle('active',x.dataset.camp===b.dataset.camp));$('#camp-detail').textContent=row.textContent.replace('↗','').trim();if(b.classList.contains('camp-row')){const pin=$$('.map-pin').find(x=>x.dataset.camp===b.dataset.camp);pin?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});}}));
}
async function initPlanner(){
 const result=await fetch('/data/planner.json');if(!result.ok)throw Error('装备资料暂时无法加载，请刷新重试。');const d=await result.json();let plan=storage.get(planKey,{});const type=$('#planner-weapon-type'),weapon=$('#planner-weapon');const parts=[['HELM','头部'],['BODY','身体'],['ARM','腕部'],['WAIST','腰部'],['LEG','腿部']];
 const queryWeapon=new URLSearchParams(location.search).get('weapon');if(queryWeapon&&d.weapons.some(w=>w.id===queryWeapon))plan.weapon=queryWeapon;
 function options(items,empty){return `<option value="">${empty}</option>`+items.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');}
 function populateWeapons(){const choices=d.weapons.filter(w=>w.type===type.value);weapon.innerHTML=options(choices,type.value?'选择武器':'先选择武器类别');weapon.value=choices.some(x=>x.id===plan.weapon)?plan.weapon:'';}
 const selectedWeapon=d.weapons.find(w=>w.id===plan.weapon);if(selectedWeapon)type.value=selectedWeapon.type;populateWeapons();
 $('#armor-selects').innerHTML=parts.map(([key,name])=>`<label class="planner-field">${name}<select data-armor-part="${key}" aria-label="选择${name}防具">${options(d.armors.filter(a=>a.type===key),`选择${name}防具`)}</select></label>`).join('');
 $$('[data-armor-part]').forEach(s=>{s.value=plan[s.dataset.armorPart]||'';s.addEventListener('change',()=>{plan[s.dataset.armorPart]=s.value;update();});});
 type.addEventListener('change',()=>{plan.weapon='';populateWeapons();update();});weapon.addEventListener('change',()=>{plan.weapon=weapon.value;update();});
 let materialText='';
 function update(){storage.set(planKey,plan);const armor=parts.map(([key])=>d.armors.find(a=>a.id===plan[key])).filter(Boolean),w=d.weapons.find(w=>w.id===plan.weapon),equipped=[w,...armor].filter(Boolean);const defense=armor.reduce((sum,a)=>sum+(a.defense||0),0);const attrs=[['基础防御',defense],['已选防具',`${armor.length} / 5`],['武器攻击',w?.attack??'—'],...Object.entries({fire:'火耐性',water:'水耐性',thunder:'雷耐性',ice:'冰耐性',dragon:'龙耐性'}).map(([key,name])=>[name,armor.reduce((sum,a)=>sum+(a.resistances?.[key]||0),0)])];$('#planner-stats').innerHTML=attrs.map(([name,value])=>`<div><span>${name}</span><b>${value}</b></div>`).join('');const skills=new Map(),materials=new Map();for(const e of equipped){for(const s of e.skills||[]){const prev=skills.get(s.id)||{...s,level:0};prev.level+=s.level;skills.set(s.id,prev);}for(const m of e.materials||[]){const prev=materials.get(m.id)||{...m,quantity:0};prev.quantity+=m.quantity;materials.set(m.id,prev);}}
 $('#planner-skills').innerHTML=skills.size?[...skills.values()].map(s=>{const sk=d.skills.find(x=>x.id===s.id);const cap=sk?.maxLevel||s.level;return `<a href="/skills/${esc(sk?.slug||s.id)}/" class="skill-tag">${esc(s.name)} <b>Lv.${Math.min(s.level,cap)}${s.level>cap?`（合计 ${s.level}）`:''}</b></a>`;}).join(''):'<p class="muted">选入装备后显示自带技能。</p>';
 const mats=[...materials.values()].sort((a,b)=>b.quantity-a.quantity);$('#planner-materials').innerHTML=mats.length?`<ul class="material-list">${mats.map(m=>{const item=d.items.find(x=>x.id===m.id);return `<li>${m.image?`<img src="${esc(m.image)}" alt="">`:''}<a href="/items/${esc(item?.slug||m.id)}/">${esc(m.name)}</a><b>× ${m.quantity}</b></li>`;}).join('')}</ul>`:'<p class="muted">选入装备后显示已收录的制作需求。</p>';materialText=`荒野手记 · 装备制作清单\n${equipped.map(x=>x.name).join(' / ')}\n\n${mats.map(m=>`${m.name} × ${m.quantity}`).join('\n')}\n\n按基础制作资料汇总，实际升级需求请在游戏内确认。\nhttps://mhwilds.net/planner/`;$('#copy-materials').disabled=!mats.length;
 }
 $('#planner-reset').addEventListener('click',()=>{plan={};type.value='';populateWeapons();$$('[data-armor-part]').forEach(s=>s.value='');update();toast('装备计划已清空');});$('#copy-materials').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(materialText);toast('制作清单已复制');}catch{toast('复制失败，请在浏览器设置中允许剪贴板访问');}});update();
}
if(document.body.dataset.page==='planner')initPlanner().catch(e=>{$('#planner-stats').textContent=e.message;});
$$('.adsbygoogle').forEach(()=>{try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch{}});

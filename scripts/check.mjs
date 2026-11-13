import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist');
const failures=[];let pages=0;
const paths=new Set();const html=[];
async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())await walk(p);else{paths.add(p);if(p.endsWith('.html'))html.push(p);}}}await walk(out);
for(const file of html){pages++;const text=await fs.readFile(file,'utf8');if(!/<h1[ >]/.test(text))failures.push(`${file}: no H1`);if((text.match(/<h1[ >]/g)||[]).length!==1)failures.push(`${file}: H1 count`);if(!text.includes('<meta name="description"'))failures.push(`${file}: no description`);if(/ca-pub-\d{16}/.test(text)&&!JSON.parse(await fs.readFile(path.join(root,'site.config.json'),'utf8')).ads.enabled)failures.push(`${file}: advertising loaded without configuration`);
 for(const m of text.matchAll(/(?:href|src)="(\/[^"]*)"/g)){const u=m[1].replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').split(/[?#]/)[0];if(u.startsWith('//'))continue;const p=path.join(out,u.endsWith('/')?u+'index.html':u);if(!paths.has(p))failures.push(`${path.relative(out,file)}: missing ${u}`);}
}
const game=JSON.parse(await fs.readFile(path.join(root,'data/game.json'),'utf8'));
const detailPaths=['monsters','weapons','armors','items','skills','maps'].flatMap(k=>game[k].map(x=>`/${k}/${x.slug}/`));if(new Set(detailPaths).size!==detailPaths.length)failures.push('Duplicate detail routes');
for(const m of game.maps){for(const c of game.camps.filter(x=>x.mapId===m.id)){if(!m.layers.includes(c.layer))failures.push(`Camp ${c.id} refers to absent layer`);}}
const report={pages,files:paths.size,errors:failures.length,failures:failures.slice(0,50)};
console.log(JSON.stringify(report,null,2));if(failures.length)process.exit(1);

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4174);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{let url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target=path.resolve(root,'.'+url);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}let stat=await fs.stat(target).catch(()=>null);if(stat?.isDirectory()){if(!url.endsWith('/')){res.writeHead(301,{Location:url+'/'});res.end();return;}target=path.join(target,'index.html');stat=await fs.stat(target).catch(()=>null);}if(!stat?.isFile()){target=path.join(root,'404.html');res.statusCode=404;}res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(await fs.readFile(target));}catch{res.writeHead(500);res.end('Unable to serve file');}}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));

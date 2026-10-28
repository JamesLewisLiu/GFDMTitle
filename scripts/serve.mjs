import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=fileURLToPath(new URL('../',import.meta.url));
const root=resolve(repo,process.argv.includes('--dist')?'dist':'.');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.csv':'text/csv; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');let pathname=decodeURIComponent(url.pathname);
    // Preview the GitHub project-path case locally as well as the site root.
    if(pathname==='/GFDMTitle')pathname='/GFDMTitle/';
    if(pathname.startsWith('/GFDMTitle/'))pathname=pathname.slice('/GFDMTitle'.length);
    if(pathname.endsWith('/'))pathname+='index.html';
    const target=resolve(root,'.'+pathname);
    if(!target.startsWith(root+sep)||pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(403);res.end('Forbidden');return;}
    if(!(await stat(target)).isFile())throw new Error('Not a file');
    const body=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`GFDM Title Archive: http://127.0.0.1:${port}/GFDMTitle/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));

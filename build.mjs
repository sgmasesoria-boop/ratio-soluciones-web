import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
const publicFiles=['index.html','styles.css','config.js','platform-api.js','app.js'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
for(const file of publicFiles) await cp(file,`dist/${file}`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const routes={};
for(const file of publicFiles){const ext=file.split('.').pop();routes[`/${file}`]={body:await readFile(file,'utf8'),contentType:types[ext]};}
routes['/']=routes['/index.html'];
const worker=`const routes=${JSON.stringify(routes)};export default{async fetch(request){const url=new URL(request.url);const route=routes[url.pathname.replace(/\\/$/,'')||'/'];if(!route)return new Response('Página no encontrada',{status:404});const headers={'content-type':route.contentType,'cache-control':route.contentType.startsWith('text/html')?'no-store':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};return new Response(request.method==='HEAD'?null:route.body,{status:200,headers});}};`;
await writeFile('dist/server/index.js',worker,'utf8');
console.log(`Built ${publicFiles.length} files and ${Object.keys(routes).length} routes.`);

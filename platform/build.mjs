import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
const buildMode=process.argv[2]||'combined';
const targetProjectId=process.argv[3]||'';
const runtimeMode=process.argv[4]||'production';
if(!['combined','crm','portal'].includes(buildMode))throw new Error('Build mode must be combined, crm or portal.');
if(!['demo','production'].includes(runtimeMode))throw new Error('Runtime mode must be demo or production.');
const publicFiles=['index.html','styles.css','config.js','platform-api.js','crm-api.js','app.js'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
for(const file of publicFiles.filter(name=>!['config.js','index.html'].includes(name))){
  const sourceFile=file==='crm-api.js'?'platform-api.js':file;
  await cp(sourceFile,`dist/${file}`);
}
const pageTitle=buildMode==='crm'
  ? 'CRM privado | Ratio Soluciones'
  : buildMode==='portal'
    ? 'Portal privado de clientes | Ratio Soluciones'
    : 'Plataforma privada | Ratio Soluciones';
const sourceIndex=(await readFile('index.html','utf8')).replace(/<title>.*?<\/title>/,`<title>${pageTitle}</title>`);
await writeFile('dist/index.html',sourceIndex,'utf8');
const sourceConfig=await readFile(runtimeMode==='production'?'config.production.public.js':'config.js','utf8');
const resolvedConfig=sourceConfig
  .replace(/appMode:\s*'[^']+'/,`appMode: '${buildMode}'`)
  .replace(/mode:\s*'[^']+'/,`mode: '${runtimeMode}'`)
  .replace(/allowDemoAccess:\s*(true|false)/,`allowDemoAccess: ${runtimeMode==='demo'}`);
await writeFile('dist/config.js',resolvedConfig,'utf8');
if(targetProjectId)await writeFile('dist/.openai/hosting.json',JSON.stringify({project_id:targetProjectId})+'\n','utf8');
else await cp('.openai/hosting.json','dist/.openai/hosting.json');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8'};
const routes={};
for(const file of publicFiles){const ext=file.split('.').pop();routes[`/${file}`]={body:await readFile(`dist/${file}`,'utf8'),contentType:types[ext]};}
routes['/']=routes['/index.html'];
for(const path of ['/app','/restablecer'])routes[path]=routes['/index.html'];
const worker=`const routes=${JSON.stringify(routes)};export default{async fetch(request){const url=new URL(request.url);const route=routes[url.pathname.replace(/\\/$/,'')||'/'];if(!route)return new Response('Página no encontrada',{status:404});const dynamic=route.contentType.startsWith('text/html')||route.contentType.startsWith('text/javascript');const headers={'content-type':route.contentType,'cache-control':dynamic?'no-store':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};return new Response(request.method==='HEAD'?null:route.body,{status:200,headers});}};`;
const securedWorker=worker
  .replace("'x-frame-options':'DENY',","'x-frame-options':'DENY','strict-transport-security':'max-age=31536000; includeSubDomains','cross-origin-opener-policy':'same-origin',")
  .replace("connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'","connect-src 'self' https://bvpeztdfwdbiielaione.supabase.co; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests");
await writeFile('dist/server/index.js',securedWorker,'utf8');
console.log(`Built ${buildMode} mode for ${runtimeMode} with ${publicFiles.length} files and ${Object.keys(routes).length} routes.`);

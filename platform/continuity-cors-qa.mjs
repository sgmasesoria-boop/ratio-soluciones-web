import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const web='https://ratio-web-continuidad.ratio-soluci-5702.chatgpt.site';
const crm='https://ratio-crm-continuidad.ratio-soluci-5702.chatgpt.site';
const portal='https://ratio-clientes-continuidad.ratio-soluci-5702.chatgpt.site';
const http=await readFile(new URL('./supabase/functions/_shared/http.ts',import.meta.url),'utf8');
const intake=await readFile(new URL('./supabase/functions/public-intake/index.ts',import.meta.url),'utf8');
function context(source,configured){
  const sandbox={Request,Response,Headers,URL,TextEncoder,crypto,console,
    Deno:{env:{get:key=>key==='ALLOWED_WEB_ORIGINS'?configured:undefined},serve:handler=>{sandbox.handler=handler;}},
    serviceClient:new Proxy({}, {get(){throw new Error('Offline test must not access a database');}})};
  vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')),sandbox);
  return sandbox;
}
for(const configured of [undefined,'https://crm.ratiosoluciones.es']){
  const sandbox=context(http,configured);
  for(const origin of [crm,portal,'https://crm.ratiosoluciones.es']){
    sandbox.request=new Request('https://example.invalid',{method:'OPTIONS',headers:{origin}});
    const response=vm.runInContext('handleOptions(request)',sandbox);
    assert.equal(response.status,204);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
  }
  for(const origin of [web,crm+'.attacker.invalid','https://other.chatgpt.site','null']){
    sandbox.request=new Request('https://example.invalid',{method:'OPTIONS',headers:{origin}});
    const response=vm.runInContext('handleOptions(request)',sandbox);
    assert.equal(response.status,403);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
}
const sandbox=context(intake);
for(const origin of [web,'https://www.ratiosoluciones.es','https://ratiosoluciones.es']){
  const response=await sandbox.handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin}}));
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
  const invalid=await sandbox.handler(new Request('https://example.invalid',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'}));
  assert.equal(invalid.status,400);
  assert.equal((await invalid.json()).error,'INVALID_SUBMISSION');
}
for(const origin of [crm,portal,web+'.attacker.invalid','null']){
  const response=await sandbox.handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin}}));
  assert.equal(response.status,403);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
}
console.log('PASS continuity CORS: exact origins, environment override, rejected lookalikes, validation without database or email.');

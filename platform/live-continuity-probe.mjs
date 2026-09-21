// Non-mutating production probes: OPTIONS, unauthenticated POST, invalid public input.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const config=await readFile(new URL('./config.production.public.js',import.meta.url),'utf8');
const url=config.match(/supabaseUrl:\s*'([^']+)'/)[1];
const apikey=config.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
const crm='https://ratio-crm-continuidad.ratio-soluci-5702.chatgpt.site';
const portal='https://ratio-clientes-continuidad.ratio-soluci-5702.chatgpt.site';
const web='https://ratio-web-continuidad.ratio-soluci-5702.chatgpt.site';
const functions=['invite-client','update-case','manage-crm','ai-assist','document-workflow','contract-signature','case-communications','internal-document-workflow','document-export','document-indexer'];
let checks=0;
const actions={'document-workflow':'download_document','contract-signature':'download_contract_pdf','case-communications':'request_communication','internal-document-workflow':'download_internal_document','document-indexer':'index_status'};
async function probe(name,origin,method,status,expectedError){
  const response=await fetch(`${url}/functions/v1/${name}`,{method,headers:{origin,apikey,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(actions[name]?{action:actions[name]}:{})}:{}),signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,status,`${name} ${method} from ${origin}`);
  assert.equal(response.headers.get('access-control-allow-origin'),status===403?null:origin,`${name} CORS reflection`);
  if(expectedError)assert.equal((await response.json()).error,expectedError,name);
  checks++;
}
for(const name of functions){
  for(const origin of [crm,portal,'https://crm.ratiosoluciones.es','https://clientes.ratiosoluciones.es'])await probe(name,origin,'OPTIONS',204);
  await probe(name,crm+'.attacker.invalid','OPTIONS',403);
  await probe(name,crm,'POST',401,'UNAUTHORIZED');
  console.log(`PASS ${name}: old/new origins and anonymous denial`);
}
for(const origin of [web,'https://www.ratiosoluciones.es','https://ratiosoluciones.es']){
  await probe('public-intake',origin,'OPTIONS',204);
  await probe('public-intake',origin,'POST',400,'INVALID_SUBMISSION');
}
await probe('public-intake',web+'.attacker.invalid','OPTIONS',403);
console.log(`PASS ${checks} production checks; no case, user, document, email or signature created.`);

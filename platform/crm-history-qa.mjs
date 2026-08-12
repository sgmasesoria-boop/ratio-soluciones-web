import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`,token=jwt({aal:'aal2'});
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',route=>{
  const url=route.request().url(),fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:token,refresh_token:'refresh',expires_in:3600,user:{id:'admin-1'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Gestor',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill([{id:'case-1',reference:'RS-HIST-1',client_id:'client-1',client_name:'Cliente',title:'Expediente con historial',category:'Vivienda',status:'open',manual_phase:'Gestión iniciada',portal_status:'active',opened_at:'2026-08-01T09:00:00Z'}]);
  if(url.includes('/rest/v1/case_events?'))return fulfill([
    {id:'event-1',case_id:'case-1',event_type:'case_opened',title:'Expediente abierto',description:'Registro inicial',visibility:'internal',occurred_at:'2026-08-01T09:00:00Z'},
    {id:'event-2',case_id:'case-1',event_type:'document_uploaded',title:'Documentación incorporada al expediente',description:'escritura.pdf',visibility:'client',occurred_at:'2026-08-02T10:00:00Z'}
  ]);
  if(['/notifications?','/crm_tasks?','/document_requests?','/case_documents?','/case_internal_documents?','/case_working_documents?','/case_contracts?','/case_communication_requests?'].some(part=>url.includes(`/rest/v1${part}`)))return fulfill([]);
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('contraseña-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#app').waitFor({state:'visible'});
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case-1"]').click();
const openingVisible=await page.getByText('Expediente abierto',{exact:true}).isVisible();
const documentVisible=await page.getByText('Documentación incorporada al expediente',{exact:true}).isVisible();
const descriptionVisible=await page.getByText('escritura.pdf',{exact:true}).isVisible();
const chronologyOrder=await page.locator('.event strong').allTextContents().then(items=>items.indexOf('Expediente abierto')<items.indexOf('Documentación incorporada al expediente'));
const result={passed:openingVisible&&documentVisible&&descriptionVisible&&chronologyOrder&&!errors.length,openingVisible,documentVisible,descriptionVisible,chronologyOrder,errors};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

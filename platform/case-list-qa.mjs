import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const token=jwt({aal:'aal2'});
const cases=[
  {id:'case-active',reference:'RS-2026-ACTIVO',client_id:'client-a',client_name:'Ana Activa',title:'Reclamación activa',category:'Banca',status:'open',summary:'En estudio',client_next_step:'',contact_phone:'600000001',contact_email:'ana@example.es',professional_name:'',professional_title:'',professional_registration:'',professional_region:'',opened_at:'2026-08-01T09:00:00Z'},
  {id:'case-closed',reference:'RS-2026-CERRADO',client_id:'client-c',client_name:'Carlos Cerrado',title:'Expediente finalizado',category:'Vivienda',status:'archived',summary:'Finalizado',client_next_step:'',contact_phone:'699123456',contact_email:'carlos@example.es',professional_name:'',professional_title:'',professional_registration:'',professional_region:'',opened_at:'2026-07-01T09:00:00Z',closed_at:'2026-08-01T09:00:00Z'}
];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',route=>{
  const url=route.request().url();const fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:token,refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1',email:'admin@example.es'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Gestor de prueba',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill(cases);
  if(url.includes('/rest/v1/case_events?')||url.includes('/rest/v1/notifications?')||url.includes('/rest/v1/crm_tasks?')||url.includes('/rest/v1/document_requests?')||url.includes('/rest/v1/case_documents?')||url.includes('/rest/v1/case_internal_documents?')||url.includes('/rest/v1/case_working_documents?')||url.includes('/rest/v1/case_contracts?')||url.includes('/rest/v1/case_communication_requests?'))return fulfill([]);
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('contraseña-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#app').waitFor({state:'visible'});
await page.locator('[data-section="cases"]').click();
const activeVisible=await page.getByText('RS-2026-ACTIVO',{exact:true}).isVisible();
const closedHidden=await page.getByText('RS-2026-CERRADO',{exact:true}).isHidden().catch(()=>true);
await page.locator('#case-search').fill('699123456');
const closedFoundByPhone=await page.getByText('RS-2026-CERRADO',{exact:true}).isVisible();
await page.locator('#case-search').fill('');
const closedHiddenAgain=await page.getByText('RS-2026-CERRADO',{exact:true}).isHidden().catch(()=>true);
await page.locator('#case-status-filter').selectOption('closed');
const closedFilterVisible=await page.getByText('RS-2026-CERRADO',{exact:true}).isVisible();
const activeHiddenInClosed=await page.getByText('RS-2026-ACTIVO',{exact:true}).isHidden().catch(()=>true);
await page.locator('#case-search').fill('carlos@example.es');
const closedFoundByEmail=await page.getByText('RS-2026-CERRADO',{exact:true}).isVisible();
const result={passed:activeVisible&&closedHidden&&closedFoundByPhone&&closedHiddenAgain&&closedFilterVisible&&activeHiddenInClosed&&closedFoundByEmail&&!errors.length,activeVisible,closedHidden,closedFoundByPhone,closedHiddenAgain,closedFilterVisible,activeHiddenInClosed,closedFoundByEmail,errors};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

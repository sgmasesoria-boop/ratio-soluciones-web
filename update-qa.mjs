import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];const calls=[];let updated=false;let rejectedUpdateOnce=false;let latestUpdate=null;
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const adminToken=jwt({aal:'aal2'});
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',async route=>{
  const url=route.request().url();calls.push({url,method:route.request().method(),body:route.request().postData(),authorization:route.request().headers().authorization||''});
  const fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:adminToken,refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.includes('/auth/v1/token?grant_type=refresh_token'))return fulfill({access_token:adminToken,refresh_token:'refresh-next',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1',email:'admin@example.es'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Gestor de prueba',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill([{id:'case-1',reference:'RS-QA-1',client_id:'client-1',client_name:'Cliente de prueba',title:'Expediente de prueba',category:'Banca',status:updated?'study':'open',client_next_step:'',professional_name:'',professional_title:'',professional_registration:'',professional_region:'',opened_at:'2026-08-01T09:00:00Z'}]);
  if(url.includes('/rest/v1/case_events?'))return fulfill(updated?[{id:'event-1',case_id:'case-1',event_type:'study',title:latestUpdate.title,description:latestUpdate.description,visibility:'client',stage:'study',occurred_at:'2026-08-09T09:00:00Z'}]:[]);
  if(url.includes('/rest/v1/notifications?')||url.includes('/rest/v1/crm_leads?')||url.includes('/rest/v1/crm_tasks?'))return fulfill([]);
  if(url.endsWith('/functions/v1/update-case')&&!rejectedUpdateOnce){rejectedUpdateOnce=true;return route.fulfill({status:401,contentType:'application/json',body:'{"error":"UNAUTHORIZED"}'});}
  if(url.endsWith('/functions/v1/update-case')){latestUpdate=JSON.parse(route.request().postData()||'{}');updated=true;return fulfill({eventId:'event-1'});}
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('contraseña-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#app').waitFor({state:'visible'});
await page.locator('[data-section="cases"]').click();
await page.getByText('RS-QA-1',{exact:true}).waitFor();
await page.locator('[data-case-id="case-1"]').click();
await page.getByRole('button',{name:/Registrar avance/}).click();
await page.locator('#update-status').selectOption('study');
await page.locator('#update-form button[value="default"]').click();
await page.waitForTimeout(800);
const dialogClosed=!(await page.locator('#update-dialog').isVisible());
const eventVisible=await page.getByText('Estado actualizado: En estudio',{exact:true}).isVisible().catch(()=>false);
const updateCalls=calls.filter(call=>call.url.endsWith('/functions/v1/update-case'));
const updateCall=updateCalls.at(-1);
const updatePayload=JSON.parse(updateCall?.body||'{}');
const authorizationSent=updateCall?.authorization===`Bearer ${adminToken}`;
const automaticCopy=updatePayload.title==='Estado actualizado: En estudio'&&updatePayload.description==='El expediente ha pasado al estado «En estudio».';
const retriedAfterRefresh=updateCalls.length===2&&calls.some(call=>call.url.includes('grant_type=refresh_token'));
const toastText=await page.locator('#toast').textContent();
const result={passed:updated&&dialogClosed&&eventVisible&&authorizationSent&&automaticCopy&&retriedAfterRefresh&&!errors.length,updated,dialogClosed,eventVisible,authorizationSent,automaticCopy,retriedAfterRefresh,toastText,errors,calls:calls.map(call=>({url:call.url,method:call.method,authorization:Boolean(call.authorization)}))};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;


import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1360,height:980}});
const errors=[];const calls=[];let createdLead=null;
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const token=jwt({aal:'aal2'});
const convertedLead={id:'lead-converted',reference:'C-QA-001',full_name:'Cliente convertido',phone:'600000001',email:'cliente@example.es',province:'Granada',category:'Vivienda',source:'Formulario web',summary:'Consulta inicial sobre la vivienda.',status:'won',quoted_amount:500,privacy_notice_at:'2026-08-09T09:00:00Z',legal_basis:'precontractual_request',converted_case_id:'case-1',created_at:'2026-08-09T09:00:00Z',updated_at:'2026-08-09T10:00:00Z'};
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',async route=>{
  const url=route.request().url();calls.push({url,method:route.request().method(),body:route.request().postData()});
  const fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:token,refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1',email:'admin@example.es'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Administrador Ratio',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill([{id:'case-1',reference:'RS-QA-001',client_id:'client-1',client_name:'Cliente convertido',title:'Expediente de vivienda',category:'Vivienda',status:'open',client_next_step:'',professional_name:'',professional_title:'',professional_registration:'',professional_region:'Granada',opened_at:'2026-08-09T10:00:00Z'}]);
  if(url.includes('/rest/v1/case_events?'))return fulfill([{id:'event-1',case_id:'case-1',event_type:'case_update',title:'Notificación recibida',description:'Notificación recibida',visibility:'client',stage:'open',occurred_at:'2026-08-10T08:00:00Z'}]);
  if(url.includes('/rest/v1/crm_leads?'))return fulfill([...(createdLead?[createdLead]:[]),convertedLead]);
  if(url.includes('/rest/v1/crm_lead_notes?'))return fulfill([{id:'note-1',lead_id:'lead-converted',body:'Contrato firmado y comprobado.',author_id:'admin-1',created_at:'2026-08-09T11:00:00Z'}]);
  if(url.includes('/rest/v1/notifications?')||url.includes('/rest/v1/crm_tasks?')||url.includes('/rest/v1/document_requests?')||url.includes('/rest/v1/case_documents?'))return fulfill([]);
  if(url.endsWith('/functions/v1/manage-crm')){
    const payload=JSON.parse(route.request().postData()||'{}');
    if(payload.action==='create_lead'){
      createdLead={id:'lead-new',reference:'C-QA-002',full_name:payload.fullName,phone:payload.phone,email:payload.email,province:payload.province,category:payload.category,source:payload.source,summary:payload.summary,status:'new',quoted_amount:0,privacy_notice_at:'2026-08-10T09:00:00Z',legal_basis:'precontractual_request',converted_case_id:null,created_at:'2026-08-10T09:00:00Z',updated_at:'2026-08-10T09:00:00Z'};
      return fulfill({id:createdLead.id,reference:createdLead.reference});
    }
    if(payload.action==='resend_case_confirmation')return fulfill({ok:true,confirmationSent:true});
  }
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('contraseña-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#app').waitFor({state:'visible'});
const overviewTaskRemoved=await page.locator('#main #new-task').count()===0;

await page.locator('#main #new-lead').click();
await page.locator('#lead-name').fill('Consulta que se cancela');
await page.locator('#lead-phone').fill('600000009');
await page.locator('#lead-email').fill('cancelar@example.es');
await page.locator('#lead-summary').fill('Consulta completa que finalmente se cancela.');
await page.locator('#lead-privacy-notice').check();
await page.locator('#cancel-lead').click();
const cancelWorks=!(await page.locator('#lead-dialog').isVisible())&&(await page.locator('#lead-name').inputValue())==='';

await page.locator('#main #new-lead').click();
await page.locator('#lead-name').fill('Nueva consulta manual');
await page.locator('#lead-phone').fill('600000010');
await page.locator('#lead-email').fill('nueva@example.es');
await page.locator('#lead-province').fill('Madrid');
await page.locator('#lead-summary').fill('Consulta manual suficientemente detallada para la prueba.');
await page.locator('#lead-privacy-notice').check();
await page.locator('#lead-form button[type="submit"]').click();
await page.getByText('Nueva consulta manual',{exact:true}).waitFor();
const createCall=calls.find(call=>call.url.endsWith('/functions/v1/manage-crm')&&JSON.parse(call.body||'{}').action==='create_lead');
const createPayload=createCall?JSON.parse(createCall.body):{};
const createWorks=Boolean(createdLead)&&createPayload.phone==='600000010'&&createPayload.email==='nueva@example.es'&&createPayload.privacyNoticeAcknowledged===true;

await page.locator('[data-section="leads"]').click();
await page.locator('#lead-status-filter').selectOption('won');
await page.getByText('Cliente convertido',{exact:true}).click();
const consultationLabel=await page.locator('#lead-history-list .history-consultation .history-source').first().getByText('Consulta',{exact:true}).isVisible();
const caseLabel=await page.locator('#lead-history-list .history-case .history-source').getByText('Expediente',{exact:true}).isVisible();
const initialVisible=await page.getByText('Consulta recibida',{exact:true}).isVisible();
const caseChangeVisible=await page.getByText('Notificación recibida',{exact:true}).isVisible();
const historyCount=await page.locator('#lead-history-count').textContent();
await page.locator('#lead-detail-dialog .close-button').click();

await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case-1"]').click();
const internalChronologyVisible=await page.getByRole('heading',{name:'Historial cronológico completo'}).isVisible();
const resendVisible=await page.locator('#resend-case-confirmation').isVisible();
await page.locator('#resend-case-confirmation').click();
await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('Confirmación del expediente enviada'));
const resendCall=calls.some(call=>call.url.endsWith('/functions/v1/manage-crm')&&JSON.parse(call.body||'{}').action==='resend_case_confirmation');

const result={passed:overviewTaskRemoved&&cancelWorks&&createWorks&&consultationLabel&&caseLabel&&initialVisible&&caseChangeVisible&&historyCount?.includes('3 movimientos')&&internalChronologyVisible&&resendVisible&&resendCall&&!errors.length,overviewTaskRemoved,cancelWorks,createWorks,consultationLabel,caseLabel,initialVisible,caseChangeVisible,historyCount,internalChronologyVisible,resendVisible,resendCall,errors};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

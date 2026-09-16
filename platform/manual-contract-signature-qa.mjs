import {launchQaBrowser} from '../qa-browser.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await launchQaBrowser({headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const token=jwt({aal:'aal2'});let registered=false,multipartReceived=false;
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',async route=>{
  const request=route.request(),url=request.url(),fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:token,refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1',email:'admin@example.es'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Gestor de prueba',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill([{id:'case-1',reference:'RS-FIRMA-1',client_id:null,client_name:'Cliente de prueba',title:'Contrato físico',category:'Otro asunto',status:'open',summary:'Prueba',manual_phase:'',portal_status:'disabled',opened_at:'2026-08-01T09:00:00Z'}]);
  if(url.includes('/rest/v1/case_events?'))return fulfill([]);
  if(url.includes('/rest/v1/case_contracts?'))return fulfill([{id:'contract-1',case_id:'case-1',template_key:'ratio-servicios',template_version:1,contract_note:'',signer_full_name:'Cliente de prueba',signer_identifier:'00000000T',signer_address:'Dirección de prueba',cause:'Prueba de firma',work_scope:'Comprobación interna',price_amount:100,currency:'EUR',provider:registered?'manual':null,provider_request_id:registered?'manual-request':null,provider_document_id:registered?'manual-document':null,unsigned_storage_path:'case-1/contracts/contract-1/unsigned.pdf',unsigned_sha256:'a'.repeat(64),signed_storage_path:registered?'case-1/contracts/contract-1/signed.pdf':null,signed_sha256:registered?'b'.repeat(64):null,evidence_storage_path:registered?'case-1/contracts/contract-1/evidence.pdf':null,evidence_sha256:registered?'c'.repeat(64):null,signed_at:registered?'2026-08-16T10:00:00Z':null,manual_signed_on:registered?'2026-08-15':null,manual_original_location:registered?'Archivo físico de prueba':null,manual_verified_by:registered?'admin-1':null,manual_verified_at:registered?'2026-08-16T10:00:00Z':null,created_at:'2026-08-01T09:00:00Z',updated_at:'2026-08-16T10:00:00Z'}]);
  if(['/notifications?','/crm_tasks?','/document_requests?','/case_documents?','/case_internal_documents?','/case_working_documents?','/case_communication_requests?'].some(part=>url.includes(`/rest/v1${part}`)))return fulfill([]);
  if(url.endsWith('/functions/v1/contract-signature')){
    multipartReceived=(request.headers()['content-type']||'').includes('multipart/form-data');registered=true;
    return fulfill({contractId:'contract-1',provider:'manual',signedOn:'2026-08-15',verifiedAt:'2026-08-16T10:00:00Z'});
  }
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('contraseña-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#app').waitFor({state:'visible'});
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case-1"]').click();
await page.getByRole('button',{name:'Registrar firma en papel',exact:true}).click();
const dialogVisible=await page.locator('#manual-signature-dialog').isVisible();
await page.locator('#manual-signature-date').fill('2026-08-15');
await page.locator('#manual-signature-location').fill('Archivo físico de prueba');
await page.locator('#manual-signature-file').setInputFiles({name:'contrato-firmado.pdf',mimeType:'application/pdf',buffer:Buffer.from(`%PDF-1.4\n${'0'.repeat(256)}\n%%EOF`)});
await page.locator('#manual-signature-custody').check();
await page.locator('#manual-signature-form .primary-button').click();
await page.locator('#manual-signature-dialog').waitFor({state:'hidden'});
const verifiedVisible=await page.getByText(/Firma en papel verificada/).isVisible();
const portalStillManual=await page.getByRole('button',{name:'Activar portal',exact:true}).isVisible();
const result={passed:dialogVisible&&multipartReceived&&registered&&verifiedVisible&&portalStillManual&&!errors.length,dialogVisible,multipartReceived,registered,verifiedVisible,portalStillManual,errors};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;


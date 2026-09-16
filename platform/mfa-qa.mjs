import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const factorId='11111111-1111-4111-8111-111111111111';
const challengeId='22222222-2222-4222-8222-222222222222';
const jwt=payload=>`header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
let mfaVerified=false;
let verificationAttempts=0;
const calls=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));

await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-key',allowDemoAccess:false,appMode:'crm'};"}));
await page.route('https://ratio-test.supabase.co/**',async route=>{
  const request=route.request(),url=request.url();calls.push(url);
  const fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:jwt({aal:'aal1'}),refresh_token:'refresh',expires_in:3600,user:{id:'admin-1',email:'admin@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'admin-1',email:'admin@example.es',factors:mfaVerified?[{id:factorId,factor_type:'totp',status:'verified'}]:[]});
  if(url.endsWith('/auth/v1/factors'))return fulfill({id:factorId,type:'totp',totp:{qr_code:'data:image/svg+xml;utf-8,<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#fff"/><rect x="8" y="8" width="48" height="48" fill="#000"/></svg>',secret:'TESTSECRET',uri:'otpauth://totp/Ratio:admin@example.es?secret=TESTSECRET&issuer=Ratio'}});
  if(url.endsWith(`/auth/v1/factors/${factorId}/challenge`))return fulfill({id:challengeId});
  if(url.endsWith(`/auth/v1/factors/${factorId}/verify`)){
    verificationAttempts+=1;
    if(verificationAttempts===1)return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error_code:'mfa_verification_failed',msg:'Invalid TOTP code entered'})});
    mfaVerified=true;return fulfill({access_token:jwt({aal:'aal2'}),refresh_token:'mfa-refresh',expires_in:3600});
  }
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'admin-1',display_name:'Gestor Prueba',internal_role:'admin',active:true}]);
  if(url.includes('/rest/v1/cases?')||url.includes('/rest/v1/case_events?')||url.includes('/rest/v1/notifications?')||url.includes('/rest/v1/crm_tasks?')||url.includes('/rest/v1/document_requests?')||url.includes('/rest/v1/case_documents?')||url.includes('/rest/v1/case_internal_documents?')||url.includes('/rest/v1/case_working_documents?')||url.includes('/rest/v1/case_contracts?')||url.includes('/rest/v1/case_communication_requests?'))return fulfill([]);
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});

await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('input[name="email"]').fill('admin@example.es');
await page.locator('input[name="password"]').fill('password-segura');
await page.locator('#login-form button[type="submit"]').click();
await page.locator('#mfa-dialog').waitFor({state:'visible'});
const enrollmentVisible=await page.locator('#mfa-enrollment').isVisible();
await page.locator('#mfa-qr').waitFor({state:'visible'});
const qrRendered=await page.locator('#mfa-qr').evaluate(image=>image.src.startsWith('data:image/svg+xml')&&image.complete&&image.naturalWidth>0);
const appLinkVisible=await page.locator('#mfa-open-app').isVisible();
const qrVariants=await page.evaluate(()=>[
  mfaQrSource('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><path fill="#000"/></svg>'),
  mfaQrSource('%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E'),
  mfaQrSource('data:image/svg+xml;base64,PHN2Zy8+')
]);
const qrVariantsSupported=qrVariants.every(value=>value.startsWith('data:image/svg+xml'));
const textCorrect=await page.locator('#mfa-dialog').evaluate(dialog=>dialog.textContent.includes('autenticación')&&dialog.textContent.includes('Código temporal')&&!/[ÃÂ]|â†/.test(dialog.textContent));
await page.locator('#mfa-code').fill('123456');
await page.locator('#mfa-form .primary-button').click();
await page.locator('#toast').waitFor({state:'visible'});
const invalidCodeExplained=await page.locator('#toast').evaluate(toast=>toast.textContent.includes('no es válido o ha caducado')&&toast.textContent.includes('app de autenticación'));
await page.locator('#mfa-code').fill('654321');
await page.locator('#mfa-form .primary-button').click();
await page.locator('#app').waitFor({state:'visible'});

const result={
  passed:enrollmentVisible&&qrRendered&&appLinkVisible&&qrVariantsSupported&&textCorrect&&invalidCodeExplained&&verificationAttempts===2&&mfaVerified&&calls.some(url=>url.endsWith('/challenge'))&&calls.some(url=>url.endsWith('/verify'))&&!errors.length,
  enrollmentVisible,qrRendered,appLinkVisible,qrVariantsSupported,textCorrect,invalidCodeExplained,verificationAttempts,mfaVerified,errors
};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

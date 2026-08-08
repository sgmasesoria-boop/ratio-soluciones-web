import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[],calls=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'production',supabaseUrl:'https://ratio-test.supabase.co',supabaseAnonKey:'public-anon-key',allowDemoAccess:false,appMode:'portal'};"}));
await page.route('https://ratio-test.supabase.co/**',async route=>{
  const url=route.request().url();calls.push(url);const fulfill=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  if(url.includes('/auth/v1/token?grant_type=password'))return fulfill({access_token:'token',refresh_token:'refresh',expires_in:3600,user:{id:'user-1',email:'cliente@example.es'}});
  if(url.endsWith('/auth/v1/user'))return fulfill({id:'user-1',email:'cliente@example.es'});
  if(url.includes('/rest/v1/profiles?'))return fulfill([{id:'user-1',display_name:'Cliente Real',internal_role:'client',active:true}]);
  if(url.includes('/rest/v1/cases?'))return fulfill([{id:'case-1',reference:'RS-REAL-1',client_id:'user-1',client_name:'Cliente Real',title:'Expediente conectado',category:'Banca',status:'study',client_next_step:'Esperar aviso',professional_name:'Ana Pérez',professional_title:'Letrada responsable',professional_registration:'ICAM 0000',professional_region:'Madrid',opened_at:'2026-08-01T09:00:00Z'}]);
  if(url.includes('/rest/v1/case_events?'))return fulfill([{id:'event-1',case_id:'case-1',event_type:'case_opened',title:'Expediente abierto',description:'Alta confirmada.',visibility:'client',stage:'open',occurred_at:'2026-08-01T09:00:00Z'}]);
  if(url.includes('/rest/v1/notifications?'))return fulfill([]);
  if(url.endsWith('/auth/v1/logout'))return fulfill({});
  return route.fulfill({status:404,contentType:'application/json',body:'{"error":"NOT_FOUND"}'});
});
await page.goto(pathToFileURL(resolve('index.html')).href);const demoHidden=await page.locator('.demo-access').evaluate(node=>node.hidden);
await page.locator('input[name="email"]').fill('cliente@example.es');await page.locator('input[name="password"]').fill('contraseña');await page.locator('#login-form button[type="submit"]').click();
await page.getByText('Expediente conectado',{exact:true}).waitFor();
const bannerHidden=await page.locator('.test-banner').evaluate(node=>node.hidden);const referenceVisible=await page.getByText('RS-REAL-1',{exact:true}).isVisible();const professionalVisible=await page.getByText('Ana Pérez',{exact:true}).isVisible();const noDocuments=!calls.some(url=>url.includes('document')||url.includes('storage'));
const result={passed:demoHidden&&bannerHidden&&referenceVisible&&professionalVisible&&noDocuments&&!errors.length,demoHidden,bannerHidden,referenceVisible,professionalVisible,noDocuments,errors};console.log(JSON.stringify(result,null,2));
await browser.close();if(!result.passed)process.exitCode=1;

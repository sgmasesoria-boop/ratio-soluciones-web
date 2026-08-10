import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

execFileSync(process.execPath,['build.mjs','portal','','production'],{stdio:'inherit'});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const results=[];
for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const invitationUrl=`${pathToFileURL(resolve('dist/index.html')).href}#access_token=qa-token&refresh_token=qa-refresh&expires_in=3600&type=invite`;
  await page.goto(invitationUrl,{waitUntil:'load'});
  const dialog=page.locator('#password-dialog');
  const visible=await dialog.isVisible();
  const clearTitle=await page.getByRole('heading',{name:'Crea tu contraseña para entrar',exact:true}).isVisible();
  const clearAction=await page.getByRole('button',{name:/Crear contraseña y entrar/}).isVisible();
  await page.keyboard.press('Escape');
  const cannotDismiss=await dialog.isVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  await page.screenshot({path:`preview-invite-${viewport.name}.png`,fullPage:true});
  results.push({viewport:viewport.name,visible,clearTitle,clearAction,cannotDismiss,overflow,errors});
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results,null,2));
if(results.some(item=>!item.visible||!item.clearTitle||!item.clearAction||!item.cannotDismiss||item.overflow||item.errors.length))process.exitCode=1;

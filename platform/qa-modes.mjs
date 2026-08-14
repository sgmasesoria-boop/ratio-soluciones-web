import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const results=[];
for(const mode of ['portal','crm']){
  execFileSync(process.execPath,['build.mjs',mode,'','demo'],{stdio:'inherit'});
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(resolve('dist/index.html')).href,{waitUntil:'load'});
    const expectedTitle=mode==='crm'?'CRM privado | Ratio Soluciones':'Portal privado de clientes | Ratio Soluciones';
    const titleCorrect=await page.title()===expectedTitle;
    const expectedRole=mode==='crm'?'admin':'client',forbiddenRole=mode==='crm'?'client':'admin';
    const expectedVisible=await page.locator(`[data-demo-role="${expectedRole}"]`).isVisible();
    const forbiddenHidden=!(await page.locator(`[data-demo-role="${forbiddenRole}"]`).isVisible());
    await page.locator(`[data-demo-role="${expectedRole}"]`).click();
    const crmNavigation=await page.getByRole('button',{name:'Expedientes',exact:true}).count()>0;
    const correctNavigation=mode==='crm'?crmNavigation:!crmNavigation;
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
    await page.screenshot({path:`preview-${mode}-separated-${viewport.name}.png`,fullPage:true});
    results.push({mode,viewport:viewport.name,titleCorrect,expectedVisible,forbiddenHidden,correctNavigation,overflow,errors});
    await context.close();
  }
}
await browser.close();
console.log(JSON.stringify(results,null,2));
if(results.some(item=>!item.titleCorrect||!item.expectedVisible||!item.forbiddenHidden||!item.correctNavigation||item.overflow||item.errors.length))process.exitCode=1;

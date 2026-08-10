import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
const server=createServer(async(request,response)=>{try{const pathname=new URL(request.url,'http://127.0.0.1').pathname;const relative=pathname==='/'?'index.html':pathname.replace(/^\//,'');const path=normalize(join(root,relative));if(!path.startsWith(root))throw new Error('Invalid path');await stat(path);response.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});response.end(await readFile(path));}catch{response.writeHead(404);response.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});

async function completeForm(page){
  await page.goto(origin);
  await page.locator('input[name="area"]').first().check();
  await page.locator('[data-step="1"] .form-next').click();
  await page.locator('select[name="situacion"]').selectOption({index:1});
  await page.locator('[data-step="2"] .form-next').click();
  await page.locator('input[name="nombre"]').fill('Prueba interna');
  await page.locator('input[name="email"]').fill('prueba@example.es');
  await page.locator('input[name="telefono"]').fill('600000000');
  await page.locator('textarea[name="consulta"]').fill('Prueba interna del circuito de recepción.');
  await page.locator('input[name="privacidad"]').check();
}

const successPage=await browser.newPage();
let submittedPayload=null;
await successPage.route('**/functions/v1/public-intake',route=>{submittedPayload=JSON.parse(route.request().postData()||'{}');return route.fulfill({status:201,contentType:'application/json',body:'{"ok":true,"reference":"C-2026-ABC123"}'});});
await completeForm(successPage);
await successPage.locator('button[type="submit"]').click();
await successPage.waitForURL(/gracias\.html\?ref=C-2026-ABC123/);
const success={referenceVisible:await successPage.getByText('C-2026-ABC123',{exact:true}).isVisible(),emailCopyVisible:await successPage.getByText(/correo de confirmación/i).isVisible(),antispamDoesNotBlockPeople:submittedPayload?.website==='' };

const errorPage=await browser.newPage();
await errorPage.route('**/functions/v1/public-intake',route=>route.fulfill({status:400,contentType:'application/json',body:'{"error":"SUBMISSION_REJECTED"}'}));
await completeForm(errorPage);
await errorPage.locator('button[type="submit"]').click();
await errorPage.getByText(/No hemos podido registrar la consulta/i).waitFor();
const failure={staysOnForm:!errorPage.url().includes('gracias'),retryVisible:await errorPage.getByRole('button',{name:/Volver a intentar/}).isVisible()};

const result={passed:Object.values(success).every(Boolean)&&Object.values(failure).every(Boolean),success,failure};
console.log(JSON.stringify(result,null,2));
await browser.close();server.close();
if(!result.passed)process.exitCode=1;

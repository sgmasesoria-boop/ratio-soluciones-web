import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';

const edge=await readFile('supabase/functions/ai-assist/index.ts','utf8');
const app=await readFile('app.js','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js*',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'demo',allowDemoAccess:true,appMode:'crm'};"}));
await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="leads"]').click();
await page.locator('[data-lead-id]').first().click();
await page.locator('#analyze-lead-ai').click();
await page.locator('#ai-assistant-result').waitFor({state:'visible'});
await page.locator('#use-ai-internal-note').click();
const internalNoteApplied=await page.locator('#lead-detail-note').inputValue().then(value=>value==='Contactar para ampliar información.');
const internalNoteFeedback=await page.locator('#lead-detail-feedback').textContent().then(text=>text.includes('nota interna')&&text.includes('Guardar cambios'));
await page.locator('#copy-ai-draft').click();
const copyFeedback=await page.locator('#lead-detail-feedback').isVisible();
const result={
  assistantVisible:await page.locator('#ai-assistant-result').isVisible(),
  humanReviewCopy:await page.locator('#ai-assistant-result').textContent().then(text=>text.includes('revisión')&&text.includes('Aún debes revisar')===false),
  noAutomaticWrite:edge.includes('automatic_write:false')&&edge.includes("select('id,reference,province,category,summary,status,created_at')"),
  minimisesPersonalData:!edge.includes('full_name,phone,email'),
  aal2Required:edge.includes('requireAdmin(request)'),
  budgetCap:edge.includes('OPENAI_MONTHLY_HARD_LIMIT_USD')&&edge.includes('AI_BUDGET_EXCEEDED'),
  noStorage:edge.includes('store:false'),
  noDocumentChannelPromise:edge.includes('canal documental habilitado')&&edge.includes('medio seguro para aportarlos'),
  internalNoteApplied,
  internalNoteFeedback,
  noNextActionField:!app.includes('lead-detail-next-action')&&!app.includes('use-ai-next-action'),
  copyFeedback,
  visibleProgress:app.includes("setModalFeedback('#lead-detail-feedback','Analizando la consulta"),
  visibleFailure:app.includes("AI_TEMPORARILY_UNAVAILABLE:'El servicio de análisis no está disponible temporalmente"),
  diagnosticErrors:['AI_KEY_INVALID','AI_QUOTA_EXCEEDED','AI_MODEL_UNAVAILABLE','AI_REQUEST_INVALID'].every(code=>edge.includes(code)&&http.includes(code)),
  errors
};
result.passed=Object.entries(result).filter(([key])=>key!=='errors').every(([,value])=>value)&&!errors.length;
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

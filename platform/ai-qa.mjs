import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {sanitizeClientDraft} from './supabase/functions/_shared/ai-output.ts';

const edge=await readFile('supabase/functions/ai-assist/index.ts','utf8');
const app=await readFile('app.js','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const migration=await readFile('supabase/migrations/20260812003000_case_ai_audit.sql','utf8');
const hostileDraft='Estado «won» y open. [case:record] [event:c13c7744-a2c8-4fb2-9b08-ea12e4d7189cc] Los metadatos indican que el documento no está analizado. Próximo paso confirmado.';
const safeDraft=sanitizeClientDraft(hostileDraft);
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
const leadAssistantVisible=await page.locator('#ai-assistant-result').isVisible();
await page.locator('#use-ai-internal-note').click();
const internalNoteApplied=await page.locator('#lead-detail-note').inputValue().then(value=>value==='Contactar para ampliar información.');
const internalNoteFeedback=await page.locator('#lead-detail-feedback').textContent().then(text=>text.includes('nota interna')&&text.includes('Guardar cambios'));
await page.locator('#copy-ai-draft').click();
const copyFeedback=await page.locator('#lead-detail-feedback').isVisible();
await page.locator('#lead-detail-dialog .close-button').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id]').first().click();
await page.locator('#analyze-case-ai').click();
await page.locator('#case-ai-result').waitFor({state:'visible'});
const result={
  assistantVisible:leadAssistantVisible,
  humanReviewCopy:await page.locator('#ai-assistant-result').textContent().then(text=>text.includes('revisión')&&text.includes('Aún debes revisar')===false),
  noAutomaticWrite:edge.includes('automatic_write:false')&&edge.includes("action:'ai_case_analyzed'")&&!edge.includes("from('cases').update"),
  minimisesPersonalData:!edge.includes('full_name,phone,email'),
  aal2Required:edge.includes('requireAdmin(request)'),
  budgetCap:edge.includes('OPENAI_MONTHLY_HARD_LIMIT_USD')&&edge.includes('AI_BUDGET_EXCEEDED'),
  noStorage:edge.includes('store:false'),
  secureDocumentChannel:edge.includes('plataforma privada'),
  caseAssistantVisible:await page.locator('#case-ai-result').isVisible(),
  caseHumanReview:await page.locator('#case-ai-result').textContent().then(text=>text.includes('revisión')&&text.includes('El contenido de los archivos no ha sido analizado')),
  caseSourcesVisible:await page.locator('.ai-source').count()>0,
  caseDataMinimised:edge.includes("privacy_mode:'No contiene nombre, email, teléfono, DNI ni ruta de almacenamiento")&&!edge.includes("select('id,client_name"),
  documentContentBlocked:edge.includes('content_analyzed:false')&&edge.includes('document_content_analyzed:false'),
  clientDraftSanitized:edge.includes('sanitizeClientDraft(result.draft_client_update)')&&!safeDraft.includes('[case:')&&!safeDraft.includes('[event:')&&!safeDraft.includes('c13c7744-a2c8-4fb2-9b08-ea12e4d7189cc')&&!/\b(?:won|open|metadatos?)\b/i.test(safeDraft),
  caseMemoryAudited:migration.includes('create table public.case_ai_runs')&&migration.includes('automatic_write boolean not null default false')&&migration.includes('revoke all privileges on public.case_ai_runs from public, anon, authenticated'),
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

import {launchQaBrowser} from '../qa-browser.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {humanizeInternalStatus,sanitizeClientDraft} from './supabase/functions/_shared/ai-output.ts';

const edge=await readFile('supabase/functions/ai-assist/index.ts','utf8');
const app=await readFile('app.js','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const migration=await readFile('supabase/migrations/20260812003000_case_ai_audit.sql','utf8');
const hostileDraft='Estado «won» y open. [case:record] [event:c13c7744-a2c8-4fb2-9b08-ea12e4d7189cc] Los metadatos indican que el documento no está analizado.';
const safeDraft=sanitizeClientDraft(hostileDraft);

const browser=await launchQaBrowser({headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/config.js*',route=>route.fulfill({contentType:'text/javascript',body:"window.RATIO_CONFIG={mode:'demo',allowDemoAccess:true,appMode:'crm'};"}));
await page.goto(pathToFileURL(resolve('index.html')).href);
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id]').first().click();
await page.locator('#analyze-case-ai').click();
await page.locator('#case-ai-result').waitFor({state:'visible'});

const result={
  caseAssistantVisible:await page.locator('#case-ai-result').isVisible(),
  caseSourcesVisible:await page.locator('.ai-source').count()>0,
  humanReviewVisible:await page.locator('#case-ai-result').textContent().then(text=>text.toLowerCase().includes('revisi')),
  consultationNavigationRemoved:!app.includes("{id:'leads',label:'Consultas'"),
  noAutomaticWrite:edge.includes('automatic_write:false')&&edge.includes("action:'ai_case_analyzed'")&&!edge.includes("from('cases').update"),
  minimisesPersonalData:!edge.includes("select('id,client_name")&&!edge.includes('contact_phone,contact_email'),
  aal2Required:edge.includes('requireAdmin(request)'),
  budgetCap:edge.includes('OPENAI_MONTHLY_HARD_LIMIT_USD')&&edge.includes('AI_BUDGET_EXCEEDED'),
  contextCap:edge.includes('MAX_WORKING_DOCUMENTS=12')&&edge.includes('MAX_WORKING_DRAFT_TOTAL_CHARS=60000')&&edge.includes('draft_content_truncated'),
  noStorage:edge.includes('store:false'),
  documentContentControlled:edge.includes("from('case_ai_document_index')")&&edge.includes('indexed_content')&&edge.includes('document_index_complete')&&!edge.includes('prepareDocumentInputs'),
  diagnosticTraceWithoutDocumentContent:edge.includes("console.error('AI case analysis failed'")&&edge.includes('diagnostic_stage:diagnostic.stage')&&!edge.includes("console.error('AI case analysis failed',{jobId,caseId,userRequest"),
  incompleteResponseIsExplicit:edge.includes("response?.status==='incomplete'")&&edge.includes("throw new Error('AI_RESPONSE_INCOMPLETE')")&&app.includes('No se ha guardado un resultado parcial'),
  partialCoverageIsProminent:app.includes('ANÁLISIS DOCUMENTAL PARCIAL')&&app.includes('No debe considerarse una revisión completa del expediente'),
  incompleteDocumentIndexIsBlocked:edge.includes("throw new Error('DOCUMENT_REVIEW_PENDING')")&&edge.includes("throw new Error('DOCUMENT_INDEX_INCOMPLETE')")&&app.includes('Preparar documentación'),
  workingDocumentsIncluded:edge.includes("from('case_working_documents')")&&edge.includes("from('case_document_versions')"),
  internalDocumentsIncluded:edge.includes("from('case_internal_documents')")&&edge.includes("storage_bucket:INTERNAL_DOCUMENT_BUCKET")&&edge.includes("internal_document:${document.id}")&&edge.includes("prompt_version:'ratio-case-v10'"),
  privateLibraryIsBoundedAndReviewed:edge.includes('MAX_LIBRARY_PRECEDENTS=12')&&edge.includes('MAX_LIBRARY_CONTEXT_CHARS=30000')&&edge.includes("'internal_precedent'")&&edge.includes('automatic_redaction_review_required')&&edge.includes('LIBRARY_CONTEXT_IDENTIFIERS_DETECTED'),
  automaticLocalLibraryBridge:app.includes('prepareAutomaticLibraryContext')&&app.includes("'/api/search'")&&app.includes("'/api/context'")&&app.includes('ratio-local-library-v1'),
  internalDocumentsRequireSecurityReview:edge.includes("analysis_eligible:document.security_status==='accepted'")&&edge.includes('security_reviewed_at'),
  manualContextIncluded:edge.includes('event_type ai_context')&&edge.includes('corrección explícita'),
  unifiedProfessionalAssistant:app.includes('¿Qué necesitas hacer?')&&app.includes("request=$('#case-ai-request')")&&edge.includes('ratio_professional_case_work')&&edge.includes('requested_work'),
  officialResearchIsSeparated:edge.includes('researchOfficialSources')&&edge.includes('allowed_domains:OFFICIAL_DOMAINS')&&edge.includes('safeResearchQueries')&&edge.includes('official_source_urls'),
  professionalDraftIsVersioned:app.includes('saveAiDeliverable(result)')&&app.includes("action:'create_working_document'")&&app.includes("action:'add_working_document_version'")&&app.includes('sourceAiRunId:result.run_id'),
  clientDraftSanitized:edge.includes('sanitizeClientDraft(result.draft_client_update)')&&!safeDraft.includes('[case:')&&!safeDraft.includes('[event:')&&!/\b(?:won|open|metadatos?)\b/i.test(safeDraft),
  internalStatusesHumanized:humanizeInternalStatus('open','case')==='expediente abierto'&&humanizeInternalStatus('pending_review','document')==='pendiente de comprobación de seguridad'&&edge.includes("lifecycle:humanizeInternalStatus(c.status,'case')"),
  caseMemoryAudited:migration.includes('create table public.case_ai_runs')&&migration.includes('automatic_write boolean not null default false')&&migration.includes('revoke all privileges on public.case_ai_runs from public, anon, authenticated'),
  diagnosticErrors:['AI_KEY_INVALID','AI_QUOTA_EXCEEDED','AI_MODEL_UNAVAILABLE','AI_REQUEST_INVALID'].every(code=>edge.includes(code)&&http.includes(code)),
  errors
};
result.passed=Object.entries(result).filter(([key])=>key!=='errors').every(([,value])=>value)&&!errors.length;
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

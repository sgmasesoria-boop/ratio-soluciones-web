import {readFile} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const migration=await readFile('supabase/migrations/20260810134257_case_document_workflow.sql','utf8');
const intakeMigration=await readFile('supabase/migrations/20260812232733_admin_client_documents_and_ai_internal_sources.sql','utf8');
const capacityMigration=await readFile('supabase/migrations/20260817143000_expand_case_document_capacity.sql','utf8');
const clientActionMigration=await readFile('supabase/migrations/20260811213000_client_action_requests.sql','utf8');
const edge=await readFile('supabase/functions/document-workflow/index.ts','utf8');
const uploadEmail=await readFile('supabase/functions/_shared/document-upload-email.ts','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const api=await readFile('platform-api.js','utf8');
const app=await readFile('app.js','utf8');
const staticChecks={
  privateBucket:/\'case-documents\',\r?\n\s*\'case-documents\',\r?\n\s*false/.test(migration),
  noStorageObjectPolicy:!migration.includes('create policy')||!migration.includes('on storage.objects'),
  rlsEnabled:['document_requests','case_documents','document_access_events'].every(table=>migration.includes(`alter table public.${table} enable row level security`)),
  browserReadOnly:migration.includes('revoke all privileges on')&&migration.includes('grant select on'),
  serviceOnlyRpc:migration.includes('to service_role')&&migration.includes('from public,anon,authenticated'),
  privacyRecorded:migration.includes('privacy_notice_version')&&migration.includes('privacy_notice_at'),
  appendOnlyAccess:migration.includes('document_access_no_update'),
  sizeAndMimeLimits:edge.includes('MAX_BYTES=25*1024*1024')&&edge.includes("'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'"),
  judicialFileCapacity:capacityMigration.includes('case_documents_size_bytes_check')&&capacityMigration.includes('case_internal_documents_size_bytes_check')&&capacityMigration.includes('26214400')&&capacityMigration.includes("where id in ('case-documents','case-internal-documents')"),
  adminUploadCapacity:capacityMigration.includes('server_register_admin_client_document')&&capacityMigration.includes('p_size_bytes not between 1 and 26214400')&&capacityMigration.includes('to service_role'),
  repeatedUploadsAllowed:migration.includes("status in ('pending','submitted')")&&app.includes("request.status==='submitted'")&&app.includes('Añadir otro archivo'),
  adminClientIntake:edge.includes('uploadClientDocumentByAdmin')&&edge.includes("action')==='upload_client_document_by_admin")&&intakeMigration.includes('server_register_admin_client_document'),
  intakeAttribution:intakeMigration.includes("intake_channel in ('client_portal','received_by_ratio')")&&intakeMigration.includes("'client_document_received_by_ratio'")&&intakeMigration.includes("'received_by_ratio'"),
  adminIntakeServiceOnly:intakeMigration.includes('server_register_admin_client_document')&&intakeMigration.includes('from public,anon,authenticated')&&intakeMigration.includes('to service_role'),
  adminIntakeSafeError:http.includes("message==='INVALID_ADMIN_CLIENT_DOCUMENT'")&&http.includes("{error:'INVALID_ADMIN_CLIENT_DOCUMENT'},400"),
  fileSignatureValidation:edge.includes('hasExpectedSignature(bytes,file.type)'),
  internalSessionValidation:edge.includes('requireAdmin(request)')&&edge.includes('requireUser(request)'),
  uploadRollback:edge.includes("storage.from(BUCKET).remove([storagePath])"),
  temporaryDownload:edge.includes("createSignedUrl(document.storage_path,60"),
  multipartApi:api.includes('async invokeMultipart(functionName, formData)'),
  typedClientRequests:clientActionMigration.includes("request_type in ('document','clarification')"),
  clarificationAudit:clientActionMigration.includes("'clarification_submitted'")&&clientActionMigration.includes('public.server_submit_clarification'),
  serviceOnlyClarification:clientActionMigration.includes('revoke all on function public.server_submit_clarification')&&clientActionMigration.includes('to service_role'),
  clarificationEndpoint:edge.includes("input.action==='submit_clarification'")&&edge.includes('requireCaseAccess(request,user.id,caseId)'),
  uploadEmailNotification:edge.includes('sendDocumentUploadEmail')&&edge.includes('emailSent'),
  uploadEmailAudited:uploadEmail.includes("'document_upload_email_sent'")&&uploadEmail.includes("'document_upload_email_failed'"),
  uploadEmailPrivate:uploadEmail.includes('Este correo no contiene archivos ni datos sensibles')&&!uploadEmail.includes('originalName')
};

execFileSync(process.execPath,['build.mjs','combined','','demo'],{stdio:'inherit'});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:980}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(pathToFileURL(resolve('dist/index.html')).href,{waitUntil:'load'});

await page.locator('[data-demo-role="client"]').click();
await page.getByRole('button',{name:'Entregar archivo',exact:true}).click();
const privacyTextVisible=await page.getByText('Antes de continuar, lee esta información',{exact:true}).isVisible();
await page.locator('#document-file').setInputFiles({name:'contrato-prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 prueba')});
await page.locator('#document-upload-form .primary-button').click();
const blockedUntilPrivacy=await page.locator('#document-upload-dialog').isVisible();
await page.locator('#document-privacy-notice').check();
await page.locator('#document-upload-form .primary-button').click();
const uploadVisible=await page.getByText('contrato-prueba.pdf',{exact:true}).isVisible();
const uploadInTimeline=await page.getByText('Documentación entregada: Contrato de la tarjeta',{exact:true}).isVisible();
const secondUploadAvailable=await page.getByRole('button',{name:'Añadir otro archivo',exact:true}).isVisible();

await page.locator('#logout').click();
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case_01"]').click();
await page.locator('#request-document').click();
await page.locator('#document-request-type').selectOption('clarification');
await page.locator('#document-request-title').fill('Aclara la fecha del último pago');
await page.locator('#document-request-instructions').fill('Indica la fecha aproximada y el medio de pago.');
await page.locator('#document-request-form .primary-button').click();
await page.locator('#logout').click();
await page.locator('[data-demo-role="client"]').click();
await page.getByRole('button',{name:'Responder aclaración',exact:true}).click();
await page.locator('#clarification-response-text').fill('El último pago fue aproximadamente el 3 de agosto mediante transferencia.');
await page.locator('#clarification-response-form .primary-button').click();
const clarificationVisible=await page.getByText('El último pago fue aproximadamente el 3 de agosto mediante transferencia.',{exact:true}).first().isVisible();
const clarificationInTimeline=await page.getByText('Aclaración enviada: Aclara la fecha del último pago',{exact:true}).isVisible();
const noPendingAction=await page.getByText('Por ahora, nada.',{exact:true}).isVisible();

await page.locator('#logout').click();
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case_01"]').click();
await page.locator('#request-document').click();
await page.locator('#document-request-title').fill('<img src=x onerror="window.__documentXss=1">');
await page.locator('#document-request-instructions').fill('Entrega únicamente el documento solicitado.');
await page.locator('#document-request-form .primary-button').click();
const escapedRequestVisible=await page.getByText('<img src=x onerror="window.__documentXss=1">',{exact:true}).first().isVisible();
const xssSafe=await page.evaluate(()=>window.__documentXss===undefined);
const requestInTimeline=await page.getByText('Documentación solicitada: <img src=x onerror="window.__documentXss=1">',{exact:true}).isVisible();
await page.locator('#add-client-document').click();
await page.locator('#client-document-intake-file').setInputFiles({name:'escritura-recibida.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 documento entregado en mano')});
await page.locator('#client-document-intake-privacy').check();
await page.locator('#client-document-intake-form .primary-button').click();
const receivedByRatioVisible=await page.getByRole('strong').filter({hasText:'escritura-recibida.pdf'}).first().isVisible();
const receivedByRatioLabel=await page.locator('small').filter({hasText:'Recibido por Ratio'}).first().isVisible();
const receivedByRatioTimeline=await page.getByText('Documentación incorporada al expediente',{exact:true}).isVisible();
await page.locator('#logout').click();
await page.locator('[data-demo-role="client"]').click();
const receivedDocumentVisibleToClient=await page.getByRole('strong').filter({hasText:'escritura-recibida.pdf'}).first().isVisible();
const internalPanelHiddenFromClient=await page.getByRole('heading',{name:'Documentación interna',exact:true}).count()===0;
const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
await browser.close();

const result={
  passed:Object.values(staticChecks).every(Boolean)&&privacyTextVisible&&blockedUntilPrivacy&&uploadVisible&&uploadInTimeline&&secondUploadAvailable&&clarificationVisible&&clarificationInTimeline&&noPendingAction&&escapedRequestVisible&&xssSafe&&requestInTimeline&&receivedByRatioVisible&&receivedByRatioLabel&&receivedByRatioTimeline&&receivedDocumentVisibleToClient&&internalPanelHiddenFromClient&&noOverflow&&!errors.length,
  staticChecks,privacyTextVisible,blockedUntilPrivacy,uploadVisible,uploadInTimeline,secondUploadAvailable,clarificationVisible,clarificationInTimeline,noPendingAction,escapedRequestVisible,xssSafe,requestInTimeline,receivedByRatioVisible,receivedByRatioLabel,receivedByRatioTimeline,receivedDocumentVisibleToClient,internalPanelHiddenFromClient,noOverflow,errors
};
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const migration=await readFile('supabase/migrations/20260812193000_internal_case_documents.sql','utf8');
const securityMigration=await readFile('supabase/migrations/20260816183000_internal_document_security_review.sql','utf8');
const workflow=await readFile('supabase/functions/internal-document-workflow/index.ts','utf8');
const contracts=await readFile('supabase/functions/contract-signature/index.ts','utf8');
const api=await readFile('platform-api.js','utf8');
const app=await readFile('app.js','utf8');
const config=await readFile('supabase/config.toml','utf8');

const staticChecks={
  separatePrivateBucket:/\'case-internal-documents\',\r?\n\s*\'case-internal-documents\',\r?\n\s*false/.test(migration),
  rlsEnabled:migration.includes('alter table public.case_internal_documents enable row level security'),
  adminReadOnly:migration.includes('private.can_manage_case(case_id)')&&migration.includes('grant select on public.case_internal_documents to authenticated'),
  noDirectStoragePolicy:!migration.includes('on storage.objects'),
  mfaAdminRequired:workflow.includes('requireAdmin(request)'),
  safeFormats:workflow.includes("'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'"),
  signatureValidation:workflow.includes('hasExpectedSignature'),
  uploadRollback:workflow.includes('storage.from(BUCKET).remove([storagePath])'),
  hashRecorded:workflow.includes("crypto.subtle.digest('SHA-256'")&&migration.includes("sha256 text not null"),
  auditedAccess:workflow.includes("action:'internal_document_uploaded'")&&workflow.includes("action:'internal_document_download_link_created'"),
  temporaryDownload:workflow.includes('createSignedUrl(document.storage_path,60'),
  quarantineByDefault:securityMigration.includes("default 'pending_review'")&&workflow.includes("security_status:'pending_review'"),
  immutableHumanReview:securityMigration.includes("target.security_status <> 'pending_review'")&&securityMigration.includes('server_review_internal_document_security'),
  rejectedDownloadBlocked:workflow.includes("document.security_status==='rejected'"),
  reviewAction:workflow.includes("input.action==='review_internal_document_security'")&&app.includes('data-review-internal-document'),
  crmOnlyQuery:api.includes("includeCrm ? this.select('case_internal_documents'")&&api.includes('internalDocuments'),
  functionConfigured:config.includes('[functions.internal-document-workflow]'),
  contractDownload:contracts.includes("input.action==='download_contract_pdf'")&&contracts.includes('contract_pdf_download_link_created'),
  persistentContractButton:app.includes('id="download-contract-pdf"')
};
Object.entries(staticChecks).forEach(([name,value])=>assert.equal(value,true,name));

execFileSync(process.execPath,['build.mjs','combined','','demo'],{stdio:'inherit'});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:980}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.goto(pathToFileURL(resolve('dist/index.html')).href,{waitUntil:'load'});
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case_01"]').click();
const panelVisible=await page.getByRole('heading',{name:'Documentación interna',exact:true}).isVisible();
await page.locator('#add-internal-document').click();
await page.locator('#internal-document-title').fill('Borrador ficticio de prueba');
await page.locator('#internal-document-note').fill('Archivo interno sin datos personales.');
await page.locator('#internal-document-file').setInputFiles({name:'borrador-prueba.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nprueba segura')});
await page.locator('#internal-document-form .primary-button').click();
const uploadedVisible=await page.getByText('Borrador ficticio de prueba',{exact:true}).isVisible();
const quarantineVisible=await page.locator('.document-actions em').filter({hasText:'Pendiente de comprobación'}).isVisible();
page.once('dialog',dialog=>dialog.accept());
await page.getByRole('button',{name:'Marcar como seguro',exact:true}).click();
const acceptedVisible=await page.locator('.document-actions em').filter({hasText:'Comprobado'}).isVisible();
await page.locator('#logout').click();
await page.locator('[data-demo-role="client"]').click();
const clientCannotSeePanel=await page.getByRole('heading',{name:'Documentación interna',exact:true}).count()===0;
await browser.close();

const result={passed:Object.values(staticChecks).every(Boolean)&&panelVisible&&uploadedVisible&&quarantineVisible&&acceptedVisible&&clientCannotSeePanel&&!errors.length,staticChecks,panelVisible,uploadedVisible,quarantineVisible,acceptedVisible,clientCannotSeePanel,errors};
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;

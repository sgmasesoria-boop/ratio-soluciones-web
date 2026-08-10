import {readFile} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const migration=await readFile('supabase/migrations/20260810134257_case_document_workflow.sql','utf8');
const edge=await readFile('supabase/functions/document-workflow/index.ts','utf8');
const api=await readFile('platform-api.js','utf8');
const staticChecks={
  privateBucket:migration.includes("'case-documents',\n  'case-documents',\n  false"),
  noStorageObjectPolicy:!migration.includes('create policy')||!migration.includes('on storage.objects'),
  rlsEnabled:['document_requests','case_documents','document_access_events'].every(table=>migration.includes(`alter table public.${table} enable row level security`)),
  browserReadOnly:migration.includes('revoke all privileges on')&&migration.includes('grant select on'),
  serviceOnlyRpc:migration.includes('to service_role')&&migration.includes('from public,anon,authenticated'),
  privacyRecorded:migration.includes('privacy_notice_version')&&migration.includes('privacy_notice_at'),
  appendOnlyAccess:migration.includes('document_access_no_update'),
  sizeAndMimeLimits:edge.includes('MAX_BYTES=5*1024*1024')&&edge.includes("'application/pdf','image/jpeg','image/png'"),
  internalSessionValidation:edge.includes('requireAdmin(request)')&&edge.includes('requireUser(request)'),
  uploadRollback:edge.includes("storage.from(BUCKET).remove([storagePath])"),
  temporaryDownload:edge.includes("createSignedUrl(document.storage_path,60"),
  multipartApi:api.includes('async invokeMultipart(functionName, formData)')
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

await page.locator('#logout').click();
await page.locator('[data-demo-role="admin"]').click();
await page.locator('[data-section="cases"]').click();
await page.locator('[data-case-id="case_01"]').click();
await page.locator('#request-document').click();
await page.locator('#document-request-title').fill('<img src=x onerror="window.__documentXss=1">');
await page.locator('#document-request-instructions').fill('Entrega únicamente el documento solicitado.');
await page.locator('#document-request-form .primary-button').click();
const escapedRequestVisible=await page.getByText('<img src=x onerror="window.__documentXss=1">',{exact:true}).isVisible();
const xssSafe=await page.evaluate(()=>window.__documentXss===undefined);
const requestInTimeline=await page.getByText('Documentación solicitada: <img src=x onerror="window.__documentXss=1">',{exact:true}).isVisible();
const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
await browser.close();

const result={
  passed:Object.values(staticChecks).every(Boolean)&&privacyTextVisible&&blockedUntilPrivacy&&uploadVisible&&uploadInTimeline&&escapedRequestVisible&&xssSafe&&requestInTimeline&&noOverflow&&!errors.length,
  staticChecks,privacyTextVisible,blockedUntilPrivacy,uploadVisible,uploadInTimeline,escapedRequestVisible,xssSafe,requestInTimeline,noOverflow,errors
};
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=1;

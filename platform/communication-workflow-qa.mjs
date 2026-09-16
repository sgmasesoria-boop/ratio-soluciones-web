import {readFile} from 'node:fs/promises';
import {launchQaBrowser} from '../qa-browser.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const migration=await readFile('supabase/migrations/20260812170000_case_communications.sql','utf8');
const edge=await readFile('supabase/functions/case-communications/index.ts','utf8');
const contract=await readFile('CONTRACT_TEMPLATE_V1.md','utf8');
const staticChecks={
  rls:migration.includes('enable row level security')&&migration.includes('private.can_access_case(case_id)'),
  browserReadOnly:migration.includes('grant select on public.case_communication_requests to authenticated'),
  noClientMutation:migration.includes('grant select,insert,update on public.case_communication_requests to service_role'),
  clientOwnership:edge.includes("caseRecord.client_id!==user.id")&&edge.includes("portal_status"),
  adminMfa:edge.includes('requireAdmin(request)'),
  noSensitiveEmail:edge.includes('notifyRatioOfCommunication(caseId,caseRecord.reference)'),
  professionalContactNotBlocked:/ni impide la comunicaci.n directa con el profesional/.test(contract)
};

execFileSync(process.execPath,['build.mjs','combined','','demo'],{stdio:'inherit'});
const browser=await launchQaBrowser({headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1280,height:980}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.goto(pathToFileURL(resolve('dist/index.html')).href,{waitUntil:'load'});
await page.locator('[data-demo-role="client"]').click();
const channelCopyVisible=await page.getByText('Ratio coordina las comunicaciones ordinarias desde este portal.',{exact:false}).isVisible();
await page.locator('#request-communication').click();
await page.locator('#communication-subject').fill('Necesito comentar una notificación');
await page.locator('#communication-message').fill('He recibido una carta y necesito saber cuál es el siguiente paso.');
await page.locator('#communication-deadline').fill('La carta indica un plazo que vence el 20 de agosto.');
await page.locator('#communication-availability').fill('Por la tarde.');
await page.locator('#communication-form .primary-button').click();
const requestVisible=await page.getByText('Necesito comentar una notificación',{exact:true}).first().isVisible();
await page.locator('#logout').click();await page.locator('[data-demo-role="admin"]').click();await page.locator('[data-section="cases"]').click();await page.locator('[data-case-id="case_01"]').click();
await page.locator('[data-respond-communication]').first().click();
await page.locator('#communication-response-text').fill('Hemos revisado tu aviso y coordinaremos una llamada con el profesional asignado.');
await page.locator('#communication-response-form .primary-button').click();
const responseVisible=await page.getByText('Hemos revisado tu aviso y coordinaremos una llamada con el profesional asignado.',{exact:true}).isVisible();
const noProfessionalPhone=await page.locator('.professional-card a[href^="tel:"],.professional-card a[href^="mailto:"]').count()===0;
const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth);
await browser.close();
const result={passed:Object.values(staticChecks).every(Boolean)&&channelCopyVisible&&requestVisible&&responseVisible&&noProfessionalPhone&&noOverflow&&!errors.length,staticChecks,channelCopyVisible,requestVisible,responseVisible,noProfessionalPhone,noOverflow,errors};
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;

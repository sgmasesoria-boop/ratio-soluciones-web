import {launchQaBrowser} from '../qa-browser.mjs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

execFileSync(process.execPath,['build.mjs','combined','','demo'],{stdio:'inherit'});
const browser=await launchQaBrowser({headless:true,args:['--allow-file-access-from-files']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('dialog',dialog=>dialog.accept());
await page.goto(pathToFileURL(resolve('dist/index.html')).href,{waitUntil:'load'});
await page.locator('[data-demo-role="admin"]').click();

const consultationNavigationRemoved=await page.locator('[data-section="leads"]').count()===0;
await page.locator('#new-lead').click();
await page.locator('#lead-name').fill('Persona Expediente Único');
await page.locator('#lead-phone').fill('600123456');
await page.locator('#lead-email').fill('expediente@example.es');
await page.locator('#lead-summary').fill('Necesita estudiar un asunto con documentación y posibles escritos posteriores.');
await page.locator('#lead-privacy-notice').check();
await page.locator('#lead-form button[value="default"]').click();
await page.getByText('Persona Expediente Único',{exact:false}).first().waitFor();

await page.locator('#edit-case-record').click();
await page.locator('#case-record-dialog').waitFor({state:'visible'});
await page.locator('#case-record-phase').fill('Pendiente de revisar documentación inicial');
await page.locator('#case-record-note').fill('Primera valoración interna registrada manualmente.');
await page.locator('#case-record-form button[value="default"]').click();
const manualPhaseVisible=await page.getByText('Pendiente de revisar documentación inicial',{exact:true}).first().isVisible();
const noteVisible=await page.getByText('Primera valoración interna registrada manualmente.',{exact:true}).isVisible();

await page.locator('#new-working-document').click();
await page.locator('#working-document-title').fill('Demanda de prueba');
await page.locator('#working-document-type').fill('Demanda judicial');
await page.locator('#working-document-status').fill('Pendiente de borrador');
await page.locator('#working-document-form button[value="default"]').click();

for(let version=1;version<=5;version+=1){
  await page.locator('.add-document-version').click();
  await page.locator('#document-version-status').fill(`Borrador ${version}`);
  await page.locator('#document-version-summary').fill(`Cambios de la versión ${version}`);
  await page.locator('#document-version-content').fill(`Contenido independiente de la versión ${version}.`);
  await page.locator('#document-version-form button[value="default"]').click();
}
const fiveVersionsVisible=await page.getByText('Borrador 5 · 5 versiones',{exact:true}).isVisible();
await page.getByRole('button',{name:'Abrir documento',exact:true}).click();
const latestVersionVisible=await page.locator('#working-document-view-content').textContent()==='Contenido independiente de la versión 5.';
await page.locator('#working-document-view-version').selectOption({index:4});
const firstVersionAccessible=await page.locator('#working-document-view-content').textContent()==='Contenido independiente de la versión 1.';
await page.locator('#create-working-document-version-from-current').click();
const sourceVersionPrefilled=await page.locator('#document-version-content').inputValue()==='Contenido independiente de la versión 1.';
await page.getByRole('button',{name:'Cancelar',exact:true}).click();
const clientRequestHiddenBeforeContract=await page.locator('#request-document').count()===0;
const portalActivationHiddenBeforeSignature=await page.locator('#activate-case-portal').count()===0;
await page.locator('#prepare-contract').click();
await page.locator('#contract-note').fill('Revisar internamente antes del envío');
await page.locator('#contract-signer-id').fill('00000000T');
await page.locator('#contract-signer-address').fill('Calle de prueba 1, Granada');
await page.locator('#contract-cause').fill('Asunto de prueba para contratación');
await page.locator('#contract-work-scope').fill('Revisión, preparación y realización manual de las actuaciones descritas para este caso.');
await page.locator('#contract-price').fill('750');
await page.locator('#contract-form button[value="default"]').click();
const contractNoteVisible=await page.getByText('Revisar internamente antes del envío',{exact:true}).first().isVisible();
await page.locator('#generate-contract-pdf').click();
const contractPdfGenerated=await page.getByText('PDF preparado y protegido con huella SHA-256:',{exact:false}).isVisible();
const sendActionVisible=await page.locator('#send-contract-signature').isVisible();
await page.locator('#send-contract-signature').click();
const signatureRequestRecorded=await page.getByText('Envío registrado',{exact:false}).first().isVisible();
const portalStillHiddenWithoutSignature=await page.locator('#activate-case-portal').count()===0;

await page.evaluate(()=>{
  const key='ratio-platform-crm-v1';const stored=JSON.parse(localStorage.getItem(key));const target=stored.cases.find(item=>item.client.includes('Persona Expediente'));
  const contract=stored.contracts.find(item=>item.caseId===target.id);contract.signedAt=new Date().toISOString();contract.invalidatedAt='';contract.provider='test-provider';contract.providerRequestId='test-signature';localStorage.setItem(key,JSON.stringify(stored));
});
await page.reload({waitUntil:'load'});
await page.locator('[data-section="cases"]').click();
await page.getByText('Persona Expediente Único',{exact:false}).first().click();
await page.locator('#activate-case-portal').click();
const portalActivated=await page.getByText('Activo',{exact:true}).first().isVisible();
const clientRequestVisibleAfterContract=await page.locator('#request-document').isVisible();

const result={passed:consultationNavigationRemoved&&manualPhaseVisible&&noteVisible&&fiveVersionsVisible&&latestVersionVisible&&firstVersionAccessible&&sourceVersionPrefilled&&clientRequestHiddenBeforeContract&&portalActivationHiddenBeforeSignature&&contractNoteVisible&&contractPdfGenerated&&sendActionVisible&&signatureRequestRecorded&&portalStillHiddenWithoutSignature&&portalActivated&&clientRequestVisibleAfterContract&&!errors.length,consultationNavigationRemoved,manualPhaseVisible,noteVisible,fiveVersionsVisible,latestVersionVisible,firstVersionAccessible,sourceVersionPrefilled,clientRequestHiddenBeforeContract,portalActivationHiddenBeforeSignature,contractNoteVisible,contractPdfGenerated,sendActionVisible,signatureRequestRecorded,portalStillHiddenWithoutSignature,portalActivated,clientRequestVisibleAfterContract,errors};
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.passed)process.exitCode=1;

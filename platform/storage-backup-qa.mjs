import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, cryptoSelfTest, restoreBackup } from './operations/storage-backup.mjs';

const source=await readFile('operations/storage-backup.mjs','utf8');
const runbook=await readFile('operations/STORAGE_BACKUP_RUNBOOK.md','utf8');
const launcher=await readFile('operations/backup-now.ps1','utf8');
const restoreLauncher=await readFile('operations/restore-backup.ps1','utf8');
const retention=await readFile('RETENTION_POLICY.md','utf8');
const failures=[];

const temporaryRoot=await mkdtemp(join(tmpdir(),'ratio-backup-restore-qa-'));
const sourceRoot=join(temporaryRoot,'source');
const restoreRoot=join(temporaryRoot,'restore');
const originalFetch=globalThis.fetch;
try{
  const fixture=Buffer.from('DOCUMENTO FICTICIO RATIO. PRUEBA DE RESTAURACION.','utf8');
  await mkdir(sourceRoot);
  await mkdir(restoreRoot);
  globalThis.fetch=async url=>{
    const value=String(url);
    if(value.endsWith('/storage/v1/bucket'))return {ok:true,json:async()=>[{id:'case-documents',public:false}]};
    if(value.includes('/storage/v1/object/list/'))return {ok:true,json:async()=>[{id:'fixture',name:'pruebas/documento.txt',metadata:{}}]};
    if(value.includes('/storage/v1/object/authenticated/'))return {ok:true,arrayBuffer:async()=>fixture};
    return {ok:false,status:404};
  };
  const created=await createBackup({
    baseUrl:'https://bvpeztdfwdbiielaione.supabase.co',serviceKey:`sb_secret_${'x'.repeat(50)}`,
    passphrase:'prueba-segura-no-usar-123456',output:sourceRoot
  });
  const restored=await restoreBackup({
    passphrase:'prueba-segura-no-usar-123456',target:created.target,output:restoreRoot
  });
  const recovered=await readFile(join(restored.target,'case-documents','pruebas','documento.txt'));
  const report=JSON.parse(await readFile(join(restored.target,'restore-report.json'),'utf8'));
  if(!recovered.equals(fixture)||!report.integrityVerified||report.productionModified!==false||restored.objectCount!==1)failures.push('La prueba completa de copia y restauración aislada no conserva contenido e integridad.');
  const beforeFailure=await readdir(restoreRoot);
  let wrongPasswordBlocked=false;
  try{await restoreBackup({passphrase:'otra-clave-ficticia-1234567890',target:created.target,output:restoreRoot});}catch{wrongPasswordBlocked=true;}
  if(!wrongPasswordBlocked||JSON.stringify(await readdir(restoreRoot))!==JSON.stringify(beforeFailure))failures.push('Una contraseña incorrecta no debe crear salida de restauración.');
  let overlappingRestoreBlocked=false;
  try{await restoreBackup({passphrase:'prueba-segura-no-usar-123456',target:created.target,output:created.target});}catch{overlappingRestoreBlocked=true;}
  if(!overlappingRestoreBlocked)failures.push('La restauración no debe escribir sobre su copia de origen.');

  const failedRoot=join(temporaryRoot,'failed');
  await mkdir(failedRoot);
  globalThis.fetch=async()=>({ok:false,status:401});
  let failureBlocked=false;
  try{
    await createBackup({
      baseUrl:'https://bvpeztdfwdbiielaione.supabase.co',serviceKey:`sb_secret_${'y'.repeat(50)}`,
      passphrase:'prueba-segura-no-usar-123456',output:failedRoot
    });
  }catch{failureBlocked=true;}
  if(!failureBlocked||(await readdir(failedRoot)).length!==0)failures.push('Una copia fallida deja residuos o no propaga el error.');
}catch(error){
  failures.push(`La prueba completa de restauración falla: ${error.message}`);
}finally{
  globalThis.fetch=originalFetch;
  await rm(temporaryRoot,{recursive:true,force:true});
}

if(!cryptoSelfTest())failures.push('La prueba criptográfica en memoria no supera el ciclo cifrar/descifrar.');
if(!source.includes("createCipheriv('aes-256-gcm'")||!source.includes('scryptSync('))failures.push('La copia no utiliza AES-256-GCM con derivación fuerte.');
if(!source.includes("if(!serviceKey.startsWith('sb_secret_'))headers.authorization"))failures.push('La copia no diferencia una Secret key moderna de una service_role JWT antigua.');
if(!source.includes("payload?.role==='service_role'")||!source.includes('ELEVATED_SUPABASE_KEY_REQUIRED'))failures.push('La copia no bloquea claves públicas o JWT sin rol service_role.');
if(!source.includes("if(!completed)await rm(target,{recursive:true,force:true})"))failures.push('Una copia incompleta puede quedar abandonada en el destino.');
if(!source.includes("relative(WORKSPACE_ROOT,destination)")||source.includes("relative(workspace,destination)"))failures.push('La validación del destino depende de la carpeta desde la que se abre la consola.');
if(!source.includes('BACKUP_DESTINATION_MUST_BE_OUTSIDE_WORKSPACE'))failures.push('La copia puede guardarse accidentalmente dentro del repositorio.');
if(!source.includes("hostname!==`${EXPECTED_PROJECT_REF}.supabase.co`"))failures.push('La herramienta puede apuntar a un proyecto Supabase distinto.');
if(!source.includes('manifest.enc')||!source.includes('OBJECT_INTEGRITY_MISMATCH'))failures.push('La copia no tiene manifiesto cifrado o verificación individual.');
if(!source.includes('INVALID_BACKUP_OBJECT_NAME')||!source.includes('tamperBlocked'))failures.push('La verificación no bloquea nombres manipulados o alteraciones cifradas.');
if(!source.includes('restoreBackup')||!source.includes('RESTORE_PATH_ESCAPE')||!source.includes("flag:'wx'"))failures.push('La restauración no bloquea rutas manipuladas o sobrescrituras.');
if(!source.includes('RESTORE_DESTINATION_MUST_BE_SEPARATE')||!source.includes('productionModified:false'))failures.push('La restauración no exige aislamiento o no acredita que producción permanece intacta.');
if(source.includes("console.log(serviceKey")||source.includes("console.log(passphrase"))failures.push('La herramienta puede mostrar secretos.');
if(!runbook.includes('no los archivos físicos')||!runbook.includes('Prueba trimestral de restauración'))failures.push('El procedimiento no documenta el límite de las copias o la restauración.');
if(!retention.includes('copia de archivos de Storage se controlan por separado')||!retention.includes('una restauración posterior obliga a repetir la supresión'))failures.push('Conservación y supresión no contemplan la copia física de Storage.');
if(!launcher.includes('UseSystemPasswordChar = $true')||!launcher.includes('LOS_DESTINOS_DEBEN_SER_DIFERENTES'))failures.push('El asistente no oculta las claves o no exige dos destinos.');
if(!launcher.includes('FALLO_AL_VERIFICAR_LA_PRIMERA_COPIA')||!launcher.includes('FALLO_AL_VERIFICAR_LA_SEGUNDA_COPIA'))failures.push('El asistente no verifica las dos copias.');
if(!launcher.includes('Remove-Item Env:RATIO_SUPABASE_SERVICE_ROLE_KEY')||!launcher.includes('$serviceKey = $null'))failures.push('El asistente no limpia las credenciales al finalizar.');
if(!restoreLauncher.includes('UseSystemPasswordChar = $true')||!restoreLauncher.includes('verify --target')||!restoreLauncher.includes('restore --target'))failures.push('El asistente de restauración no protege la contraseña o no verifica antes de recuperar.');
if(!restoreLauncher.includes('Remove-Item Env:RATIO_BACKUP_PASSPHRASE')||!restoreLauncher.includes('Producción no se ha modificado'))failures.push('El asistente de restauración no limpia la contraseña o no informa del aislamiento.');

console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;

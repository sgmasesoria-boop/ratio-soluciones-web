import { readFile } from 'node:fs/promises';
import { cryptoSelfTest } from './operations/storage-backup.mjs';

const source=await readFile('operations/storage-backup.mjs','utf8');
const runbook=await readFile('operations/STORAGE_BACKUP_RUNBOOK.md','utf8');
const launcher=await readFile('operations/backup-now.ps1','utf8');
const retention=await readFile('RETENTION_POLICY.md','utf8');
const failures=[];

if(!cryptoSelfTest())failures.push('La prueba criptográfica en memoria no supera el ciclo cifrar/descifrar.');
if(!source.includes("createCipheriv('aes-256-gcm'")||!source.includes('scryptSync('))failures.push('La copia no utiliza AES-256-GCM con derivación fuerte.');
if(!source.includes('BACKUP_DESTINATION_MUST_BE_OUTSIDE_WORKSPACE'))failures.push('La copia puede guardarse accidentalmente dentro del repositorio.');
if(!source.includes("hostname!==`${EXPECTED_PROJECT_REF}.supabase.co`"))failures.push('La herramienta puede apuntar a un proyecto Supabase distinto.');
if(!source.includes('manifest.enc')||!source.includes('OBJECT_INTEGRITY_MISMATCH'))failures.push('La copia no tiene manifiesto cifrado o verificación individual.');
if(!source.includes('INVALID_BACKUP_OBJECT_NAME')||!source.includes('tamperBlocked'))failures.push('La verificación no bloquea nombres manipulados o alteraciones cifradas.');
if(source.includes("console.log(serviceKey")||source.includes("console.log(passphrase"))failures.push('La herramienta puede mostrar secretos.');
if(!runbook.includes('no los archivos físicos')||!runbook.includes('Prueba trimestral de restauración'))failures.push('El procedimiento no documenta el límite de las copias o la restauración.');
if(!retention.includes('copia de archivos de Storage se controlan por separado')||!retention.includes('una restauración posterior obliga a repetir la supresión'))failures.push('Conservación y supresión no contemplan la copia física de Storage.');
if(!launcher.includes('UseSystemPasswordChar = $true')||!launcher.includes('LOS_DESTINOS_DEBEN_SER_DIFERENTES'))failures.push('El asistente no oculta las claves o no exige dos destinos.');
if(!launcher.includes('FALLO_AL_VERIFICAR_LA_PRIMERA_COPIA')||!launcher.includes('FALLO_AL_VERIFICAR_LA_SEGUNDA_COPIA'))failures.push('El asistente no verifica las dos copias.');
if(!launcher.includes('Remove-Item Env:RATIO_SUPABASE_SERVICE_ROLE_KEY')||!launcher.includes('$serviceKey = $null'))failures.push('El asistente no limpia las credenciales al finalizar.');

console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;

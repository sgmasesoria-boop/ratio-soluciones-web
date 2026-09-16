import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packDatabaseBackup, verifyDatabaseBackup, restoreDatabaseBackup } from './operations/database-backup.mjs';

const root=await mkdtemp(join(tmpdir(),'ratio-db-qa-'));
const source=join(root,'source');
const primary=join(root,'primary');
const restore=join(root,'restore');
const passphrase='prueba-ficticia-ratio-2026-segura';
let passed=0;

function ok(condition,message){if(!condition)throw new Error(message);passed++;}

try{
  await Promise.all([mkdir(source),mkdir(primary),mkdir(restore)]);
  const files={
    'schema.sql':'create table public.test(id bigint primary key);\n',
    'data.sql':'COPY public.test (id) FROM stdin;\n1\n\\.\n',
    'migrations-schema.sql':'create schema if not exists supabase_migrations;\n',
    'migrations-data.sql':'-- migraciones ficticias\nselect 1;\n',
    'metadata.json':`\uFEFF${JSON.stringify({projectRef:'bvpeztdfwdbiielaione',createdAt:new Date().toISOString()})}`
  };
  for(const [name,content] of Object.entries(files))await writeFile(join(source,name),content);

  let shortPasswordBlocked=false;
  try{await packDatabaseBackup({source,output:primary,passphrase:'corta-12345'});}catch{shortPasswordBlocked=true;}
  ok(shortPasswordBlocked,'SHORT_PASSWORD_NOT_BLOCKED');

  const packed=await packDatabaseBackup({source,output:primary,passphrase});
  ok(packed.fileCount===5,'PACK_COUNT');
  const verified=await verifyDatabaseBackup({target:packed.target,passphrase});
  ok(verified.verified&&verified.fileCount===5,'VERIFY');
  const restored=await restoreDatabaseBackup({target:packed.target,output:restore,passphrase});
  ok(restored.restored&&restored.fileCount===5,'RESTORE');
  for(const [name,content] of Object.entries(files))ok(await readFile(join(restored.target,name),'utf8')===content,`CONTENT_${name}`);

  let wrongPasswordBlocked=false;
  try{await verifyDatabaseBackup({target:packed.target,passphrase:'otra-contrasena-muy-larga-y-distinta'});}catch{wrongPasswordBlocked=true;}
  ok(wrongPasswordBlocked,'WRONG_PASSWORD_NOT_BLOCKED');

  const beforeFailure=await readdir(restore);
  let failedRestoreBlocked=false;
  try{await restoreDatabaseBackup({target:packed.target,output:restore,passphrase:'otra-contrasena-muy-larga-y-distinta'});}catch{failedRestoreBlocked=true;}
  ok(failedRestoreBlocked,'WRONG_PASSWORD_RESTORE_NOT_BLOCKED');
  ok(JSON.stringify(await readdir(restore))===JSON.stringify(beforeFailure),'FAILED_RESTORE_LEFT_OUTPUT');

  let nestedRestoreBlocked=false;
  try{await restoreDatabaseBackup({target:packed.target,output:packed.target,passphrase});}catch{nestedRestoreBlocked=true;}
  ok(nestedRestoreBlocked,'RESTORE_OVER_BACKUP_NOT_BLOCKED');

  const index=JSON.parse(await readFile(join(packed.target,'backup.json'),'utf8'));
  index.manifestSha256='0'.repeat(64);
  await writeFile(join(packed.target,'backup.json'),JSON.stringify(index));
  let tamperBlocked=false;
  try{await verifyDatabaseBackup({target:packed.target,passphrase});}catch{tamperBlocked=true;}
  ok(tamperBlocked,'TAMPER_NOT_BLOCKED');
  let tamperedRestoreBlocked=false;
  try{await restoreDatabaseBackup({target:packed.target,output:restore,passphrase});}catch{tamperedRestoreBlocked=true;}
  ok(tamperedRestoreBlocked,'TAMPERED_RESTORE_NOT_BLOCKED');
  ok(JSON.stringify(await readdir(restore))===JSON.stringify(beforeFailure),'TAMPERED_RESTORE_LEFT_OUTPUT');

  process.stdout.write(`Database backup QA: ${passed}/${passed} controles superados.\n`);
}finally{await rm(root,{recursive:true,force:true});}

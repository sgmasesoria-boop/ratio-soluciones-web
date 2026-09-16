import { createHash, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PROJECT_REF='bvpeztdfwdbiielaione';
const MAGIC=Buffer.from('RATIODB01');
const WORKSPACE_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const EXPECTED_FILES=['data.sql','metadata.json','migrations-data.sql','migrations-schema.sql','schema.sql'];

function sha256(value){return createHash('sha256').update(value).digest('hex');}
function parseJsonText(value){return JSON.parse(String(value).replace(/^\uFEFF/,''));}

function deriveKey(passphrase,salt){
  if(typeof passphrase!=='string'||passphrase.length<12)throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
  return scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
}

function encrypt(clear,key,aad){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(aad,'utf8'));
  const ciphertext=Buffer.concat([cipher.update(clear),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),ciphertext]);
}

function decrypt(encrypted,key,aad){
  if(encrypted.length<MAGIC.length+28||!encrypted.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('INVALID_ENCRYPTED_FILE');
  const iv=encrypted.subarray(MAGIC.length,MAGIC.length+12);
  const tag=encrypted.subarray(MAGIC.length+12,MAGIC.length+28);
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(aad,'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted.subarray(MAGIC.length+28)),decipher.final()]);
}

function externalDestination(path){
  const destination=resolve(path);
  const rel=relative(WORKSPACE_ROOT,destination);
  if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)))throw new Error('BACKUP_DESTINATION_MUST_BE_OUTSIDE_WORKSPACE');
  return destination;
}

function safeRestorePath(root,name){
  if(!EXPECTED_FILES.includes(name)||basename(name)!==name)throw new Error('INVALID_RESTORE_FILE');
  const destination=resolve(root,name);
  const rel=relative(root,destination);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('RESTORE_PATH_ESCAPE');
  return destination;
}

async function validateSource(source){
  const root=resolve(source);
  const names=(await readdir(root,{withFileTypes:true})).filter(item=>item.isFile()).map(item=>item.name).sort();
  if(JSON.stringify(names)!==JSON.stringify(EXPECTED_FILES))throw new Error('UNEXPECTED_DATABASE_EXPORT_FILES');
  const metadata=parseJsonText(await readFile(join(root,'metadata.json'),'utf8'));
  if(metadata.projectRef!==EXPECTED_PROJECT_REF)throw new Error('UNEXPECTED_SUPABASE_PROJECT');
  for(const name of EXPECTED_FILES){
    const clear=await readFile(join(root,name));
    if(clear.length===0)throw new Error(`EMPTY_EXPORT_FILE_${name}`);
  }
  return root;
}

async function openBackup(passphrase,target){
  const root=resolve(target);
  const index=parseJsonText(await readFile(join(root,'backup.json'),'utf8'));
  if(index.version!==1||index.projectRef!==EXPECTED_PROJECT_REF||index.kind!=='database-logical')throw new Error('INVALID_BACKUP_INDEX');
  const encryptedManifest=await readFile(join(root,'manifest.enc'));
  if(sha256(encryptedManifest)!==index.manifestSha256)throw new Error('MANIFEST_HASH_MISMATCH');
  const key=deriveKey(passphrase,Buffer.from(index.salt,'base64'));
  try{
    const clearManifest=decrypt(encryptedManifest,key,'ratio-database-manifest-v1');
    const manifest=parseJsonText(clearManifest.toString('utf8'));
    clearManifest.fill(0);
    if(manifest.version!==1||manifest.projectRef!==EXPECTED_PROJECT_REF||manifest.kind!=='database-logical'||!Array.isArray(manifest.files))throw new Error('INVALID_BACKUP_MANIFEST');
    return {root,index,manifest,key};
  }catch(error){key.fill(0);throw error;}
}

export async function packDatabaseBackup({source,output,passphrase}){
  const sourceRoot=await validateSource(source);
  const outputRoot=externalDestination(output);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const target=join(outputRoot,`ratio-database-${stamp}`);
  const salt=randomBytes(16);
  const key=deriveKey(passphrase,salt);
  const manifest={version:1,kind:'database-logical',projectRef:EXPECTED_PROJECT_REF,createdAt:new Date().toISOString(),files:[]};
  await mkdir(target,{recursive:false});
  let completed=false;
  try{
    for(const name of EXPECTED_FILES){
      const clear=await readFile(join(sourceRoot,name));
      const aad=`ratio-database-v1\0${name}`;
      const encryptedFile=`file-${sha256(name)}.enc`;
      const encrypted=encrypt(clear,key,aad);
      await writeFile(join(target,encryptedFile),encrypted,{flag:'wx'});
      manifest.files.push({name,size:clear.length,sha256:sha256(clear),encryptedFile});
      clear.fill(0);
    }
    const clearManifest=Buffer.from(JSON.stringify(manifest),'utf8');
    const encryptedManifest=encrypt(clearManifest,key,'ratio-database-manifest-v1');
    await writeFile(join(target,'manifest.enc'),encryptedManifest,{flag:'wx'});
    await writeFile(join(target,'backup.json'),JSON.stringify({
      version:1,kind:'database-logical',projectRef:EXPECTED_PROJECT_REF,createdAt:manifest.createdAt,
      fileCount:manifest.files.length,totalBytes:manifest.files.reduce((sum,item)=>sum+item.size,0),
      salt:salt.toString('base64'),manifestSha256:sha256(encryptedManifest)
    },null,2),{encoding:'utf8',flag:'wx'});
    clearManifest.fill(0);
    completed=true;
    return {target,fileCount:manifest.files.length,totalBytes:manifest.files.reduce((sum,item)=>sum+item.size,0)};
  }finally{
    key.fill(0);
    if(!completed)await rm(target,{recursive:true,force:true});
  }
}

export async function verifyDatabaseBackup({target,passphrase}){
  const {root,index,manifest,key}=await openBackup(passphrase,target);
  try{
    let totalBytes=0;
    const names=[];
    for(const item of manifest.files){
      if(!EXPECTED_FILES.includes(item.name)||!/^file-[0-9a-f]{64}\.enc$/.test(item.encryptedFile))throw new Error('INVALID_BACKUP_FILE');
      const encrypted=await readFile(join(root,item.encryptedFile));
      const clear=decrypt(encrypted,key,`ratio-database-v1\0${item.name}`);
      if(clear.length!==item.size||sha256(clear)!==item.sha256)throw new Error('DATABASE_FILE_INTEGRITY_MISMATCH');
      totalBytes+=clear.length;
      names.push(item.name);
      clear.fill(0);
    }
    if(JSON.stringify(names.sort())!==JSON.stringify(EXPECTED_FILES)||manifest.files.length!==index.fileCount||totalBytes!==index.totalBytes)throw new Error('BACKUP_TOTAL_MISMATCH');
    return {verified:true,fileCount:manifest.files.length,totalBytes,createdAt:manifest.createdAt};
  }finally{key.fill(0);}
}

export async function restoreDatabaseBackup({target,output,passphrase}){
  const backupRoot=resolve(target);
  const outputRoot=externalDestination(output);
  const relA=relative(backupRoot,outputRoot);
  const relB=relative(outputRoot,backupRoot);
  if(!relA||(!relA.startsWith('..')&&!isAbsolute(relA))||(!relB.startsWith('..')&&!isAbsolute(relB)))throw new Error('RESTORE_DESTINATION_MUST_BE_SEPARATE');
  // Reject wrong passwords, tampering and incomplete manifests before creating output.
  await verifyDatabaseBackup({target:backupRoot,passphrase});
  const restoreRoot=join(outputRoot,`ratio-database-restore-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  const {root,manifest,key}=await openBackup(passphrase,backupRoot);
  let completed=false,created=false;
  try{
    await mkdir(restoreRoot,{recursive:false});created=true;
    for(const item of manifest.files){
      if(!EXPECTED_FILES.includes(item.name)||!/^file-[0-9a-f]{64}\.enc$/.test(item.encryptedFile))throw new Error('INVALID_BACKUP_FILE');
      const encrypted=await readFile(join(root,item.encryptedFile));
      const clear=decrypt(encrypted,key,`ratio-database-v1\0${item.name}`);
      if(clear.length!==item.size||sha256(clear)!==item.sha256)throw new Error('DATABASE_FILE_INTEGRITY_MISMATCH');
      await writeFile(safeRestorePath(restoreRoot,item.name),clear,{flag:'wx'});
      clear.fill(0);
    }
    completed=true;
    return {restored:true,target:restoreRoot,fileCount:manifest.files.length};
  }finally{
    key.fill(0);
    if(created&&!completed)await rm(restoreRoot,{recursive:true,force:true});
  }
}

function args(){
  const result={_:[]};
  for(let i=2;i<process.argv.length;i++){
    const value=process.argv[i];
    if(value.startsWith('--'))result[value.slice(2)]=process.argv[++i]; else result._.push(value);
  }
  return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const parsed=args();
  const passphrase=process.env.RATIO_BACKUP_PASSPHRASE;
  try{
    let result;
    if(parsed._[0]==='pack')result=await packDatabaseBackup({source:parsed.source,output:parsed.output,passphrase});
    else if(parsed._[0]==='verify')result=await verifyDatabaseBackup({target:parsed.target,passphrase});
    else if(parsed._[0]==='restore')result=await restoreDatabaseBackup({target:parsed.target,output:parsed.output,passphrase});
    else throw new Error('USAGE: pack|verify|restore');
    process.stdout.write(JSON.stringify(result));
  }catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}
}

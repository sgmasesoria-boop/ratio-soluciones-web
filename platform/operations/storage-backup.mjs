import { createHash, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_PROJECT_REF='bvpeztdfwdbiielaione';
const MAGIC=Buffer.from('RATIOENC1');

function sha256(value){
  return createHash('sha256').update(value).digest('hex');
}

function deriveKey(passphrase,salt){
  if(typeof passphrase!=='string'||passphrase.length<20)throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
  return scryptSync(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
}

export function encryptBuffer(clear,key,aad){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(aad,'utf8'));
  const ciphertext=Buffer.concat([cipher.update(clear),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),ciphertext]);
}

export function decryptBuffer(encrypted,key,aad){
  if(encrypted.length<MAGIC.length+28||!encrypted.subarray(0,MAGIC.length).equals(MAGIC))throw new Error('INVALID_ENCRYPTED_FILE');
  const iv=encrypted.subarray(MAGIC.length,MAGIC.length+12);
  const tag=encrypted.subarray(MAGIC.length+12,MAGIC.length+28);
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(aad,'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted.subarray(MAGIC.length+28)),decipher.final()]);
}

function apiHeaders(serviceKey,json=false){
  return {
    apikey:serviceKey,
    authorization:`Bearer ${serviceKey}`,
    ...(json?{'content-type':'application/json'}:{})
  };
}

async function requestJson(url,options){
  const response=await fetch(url,options);
  if(!response.ok)throw new Error(`STORAGE_API_${response.status}`);
  return response.json();
}

async function privateBuckets(baseUrl,serviceKey){
  const buckets=await requestJson(`${baseUrl}/storage/v1/bucket`,{headers:apiHeaders(serviceKey)});
  if(!Array.isArray(buckets))throw new Error('INVALID_BUCKET_RESPONSE');
  return buckets.filter(bucket=>bucket&&bucket.public===false).map(bucket=>String(bucket.id)).sort();
}

async function listFiles(baseUrl,serviceKey,bucket,prefix='',seen=new Set()){
  const files=[];
  for(let offset=0;;offset+=1000){
    const items=await requestJson(`${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,{
      method:'POST',headers:apiHeaders(serviceKey,true),
      body:JSON.stringify({prefix,limit:1000,offset,sortBy:{column:'name',order:'asc'}})
    });
    if(!Array.isArray(items))throw new Error('INVALID_OBJECT_LIST');
    for(const item of items){
      const objectPath=prefix?`${prefix}/${item.name}`:String(item.name);
      if(item.id||item.metadata){
        if(!seen.has(objectPath)){seen.add(objectPath);files.push(objectPath);}
      }else{
        files.push(...await listFiles(baseUrl,serviceKey,bucket,objectPath,seen));
      }
    }
    if(items.length<1000)break;
  }
  return files;
}

function encodedObjectPath(path){
  return path.split('/').map(encodeURIComponent).join('/');
}

async function downloadObject(baseUrl,serviceKey,bucket,path){
  const response=await fetch(`${baseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedObjectPath(path)}`,{
    headers:apiHeaders(serviceKey)
  });
  if(!response.ok)throw new Error(`DOWNLOAD_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function externalDestination(path){
  const destination=resolve(path);
  const workspace=resolve(process.cwd());
  const rel=relative(workspace,destination);
  if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel)))throw new Error('BACKUP_DESTINATION_MUST_BE_OUTSIDE_WORKSPACE');
  return destination;
}

export async function createBackup({baseUrl,serviceKey,passphrase,output}){
  const parsed=new URL(baseUrl);
  if(parsed.protocol!=='https:'||parsed.hostname!==`${EXPECTED_PROJECT_REF}.supabase.co`)throw new Error('UNEXPECTED_SUPABASE_PROJECT');
  if(!serviceKey||serviceKey.length<40)throw new Error('SERVICE_ROLE_KEY_REQUIRED');
  const root=externalDestination(output);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const target=join(root,`ratio-storage-${stamp}`);
  await mkdir(target,{recursive:false});

  const salt=randomBytes(16);
  const key=deriveKey(passphrase,salt);
  const manifest={version:1,projectRef:EXPECTED_PROJECT_REF,createdAt:new Date().toISOString(),objects:[]};
  try{
    const buckets=await privateBuckets(baseUrl,serviceKey);
    for(const bucket of buckets){
      const paths=await listFiles(baseUrl,serviceKey,bucket);
      for(const path of paths){
        const clear=await downloadObject(baseUrl,serviceKey,bucket,path);
        const aad=`${bucket}\0${path}`;
        const encrypted=encryptBuffer(clear,key,aad);
        const encryptedFile=`object-${sha256(aad)}.enc`;
        await writeFile(join(target,encryptedFile),encrypted,{flag:'wx'});
        manifest.objects.push({bucket,path,size:clear.length,sha256:sha256(clear),encryptedFile});
        clear.fill(0);
      }
    }
    const manifestClear=Buffer.from(JSON.stringify(manifest),'utf8');
    const manifestEncrypted=encryptBuffer(manifestClear,key,'ratio-storage-manifest-v1');
    await writeFile(join(target,'manifest.enc'),manifestEncrypted,{flag:'wx'});
    await writeFile(join(target,'backup.json'),JSON.stringify({
      version:1,projectRef:EXPECTED_PROJECT_REF,createdAt:manifest.createdAt,
      objectCount:manifest.objects.length,totalBytes:manifest.objects.reduce((sum,item)=>sum+item.size,0),
      salt:salt.toString('base64'),manifestSha256:sha256(manifestEncrypted)
    },null,2),{encoding:'utf8',flag:'wx'});
    manifestClear.fill(0);
    return {target,objectCount:manifest.objects.length,totalBytes:manifest.objects.reduce((sum,item)=>sum+item.size,0)};
  }finally{
    key.fill(0);
  }
}

export async function verifyBackup({passphrase,target}){
  const root=resolve(target);
  const index=JSON.parse(await readFile(join(root,'backup.json'),'utf8'));
  if(index.version!==1||index.projectRef!==EXPECTED_PROJECT_REF)throw new Error('INVALID_BACKUP_INDEX');
  const encryptedManifest=await readFile(join(root,'manifest.enc'));
  if(sha256(encryptedManifest)!==index.manifestSha256)throw new Error('MANIFEST_HASH_MISMATCH');
  const key=deriveKey(passphrase,Buffer.from(index.salt,'base64'));
  try{
    const clearManifest=decryptBuffer(encryptedManifest,key,'ratio-storage-manifest-v1');
    const manifest=JSON.parse(clearManifest.toString('utf8'));
    clearManifest.fill(0);
    let totalBytes=0;
    for(const item of manifest.objects){
      if(!/^object-[0-9a-f]{64}\.enc$/.test(item.encryptedFile))throw new Error('INVALID_BACKUP_OBJECT_NAME');
      const encrypted=await readFile(join(root,item.encryptedFile));
      const clear=decryptBuffer(encrypted,key,`${item.bucket}\0${item.path}`);
      if(clear.length!==item.size||sha256(clear)!==item.sha256)throw new Error('OBJECT_INTEGRITY_MISMATCH');
      totalBytes+=clear.length;
      clear.fill(0);
    }
    if(manifest.objects.length!==index.objectCount||totalBytes!==index.totalBytes)throw new Error('BACKUP_TOTAL_MISMATCH');
    return {verified:true,objectCount:manifest.objects.length,totalBytes,createdAt:manifest.createdAt};
  }finally{
    key.fill(0);
  }
}

export function cryptoSelfTest(){
  const salt=Buffer.alloc(16,7);
  const key=deriveKey('prueba-segura-no-usar-123456',salt);
  try{
    const clear=Buffer.from('DOCUMENTO FICTICIO RATIO');
    const encrypted=encryptBuffer(clear,key,'self-test');
    const recovered=decryptBuffer(encrypted,key,'self-test');
    const tampered=Buffer.from(encrypted);
    tampered[tampered.length-1]^=1;
    let tamperBlocked=false;
    try{decryptBuffer(tampered,key,'self-test');}catch{tamperBlocked=true;}
    return recovered.equals(clear)&&!encrypted.includes(clear)&&tamperBlocked;
  }finally{key.fill(0);}
}

async function main(){
  const [command,...args]=process.argv.slice(2);
  if(command==='self-test'){
    if(!cryptoSelfTest())throw new Error('CRYPTO_SELF_TEST_FAILED');
    console.log(JSON.stringify({passed:true}));
    return;
  }
  const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:'';};
  if(command==='create'){
    const result=await createBackup({
      baseUrl:process.env.RATIO_SUPABASE_URL||'',
      serviceKey:process.env.RATIO_SUPABASE_SERVICE_ROLE_KEY||'',
      passphrase:process.env.RATIO_BACKUP_PASSPHRASE||'',
      output:option('--output')
    });
    console.log(JSON.stringify(result,null,2));
    return;
  }
  if(command==='verify'){
    const result=await verifyBackup({passphrase:process.env.RATIO_BACKUP_PASSPHRASE||'',target:option('--target')});
    console.log(JSON.stringify(result,null,2));
    return;
  }
  throw new Error('USAGE: storage-backup.mjs create --output <external-folder> | verify --target <backup-folder> | self-test');
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}

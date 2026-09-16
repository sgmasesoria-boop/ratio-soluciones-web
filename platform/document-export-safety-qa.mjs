import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const cwd=fileURLToPath(new URL('.',import.meta.url));
const qaRoot=join(cwd,'.qa-document-export');
await mkdir(qaRoot,{recursive:true});
const existing=await mkdtemp(join(qaRoot,'preserve-'));
const outside=await mkdtemp(join(tmpdir(),'ratio-export-safety-'));
try{
  for(const path of [existing,outside]){
    const marker=join(path,'fixture.txt');
    await writeFile(marker,'FICTITIOUS QA DATA');
    const result=spawnSync(process.execPath,['document-export-qa.mjs',path],{cwd,encoding:'utf8',timeout:10000});
    assert.ifError(result.error);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,path===existing?/EEXIST/:/QA_OUTPUT_MUST_BE_NEW_CHILD_DIRECTORY/);
    assert.equal(await readFile(marker,'utf8'),'FICTITIOUS QA DATA');
  }
  console.log('Export safety: existing and external folders rejected without removing fixtures.');
}finally{
  await rm(existing,{recursive:true,force:true});
  await rm(outside,{recursive:true,force:true});
}

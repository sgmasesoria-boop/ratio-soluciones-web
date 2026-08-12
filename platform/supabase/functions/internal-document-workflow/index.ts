import {requireAdmin,serviceClient} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';

const BUCKET='case-internal-documents';
const MAX_BYTES=15*1024*1024;
const allowedMimeTypes=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png']);
const extensions:Record<string,string>={'application/pdf':'pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','image/jpeg':'jpg','image/png':'png'};
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function sha256(bytes:Uint8Array){const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');}
function hasExpectedSignature(bytes:Uint8Array,mimeType:string){
  if(mimeType==='application/pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  if(mimeType==='image/jpeg')return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(mimeType==='image/png')return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);
  if(mimeType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return bytes[0]===0x50&&bytes[1]===0x4b;
  return false;
}

async function uploadInternalDocument(request:Request,form:FormData){
  const admin=await requireAdmin(request);
  const caseId=clean(form.get('caseId'),36),title=clean(form.get('title'),180),note=clean(form.get('note'),1000);
  if(!validUuid(caseId)||title.length<2)throw new Error('INVALID_INTERNAL_DOCUMENT');
  const file=form.get('file');
  if(!(file instanceof File)||file.size<1||file.size>MAX_BYTES||!allowedMimeTypes.has(file.type))throw new Error('INVALID_INTERNAL_DOCUMENT_FILE');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!hasExpectedSignature(bytes,file.type))throw new Error('INVALID_INTERNAL_DOCUMENT_FILE');
  const {data:caseRecord,error:caseError}=await serviceClient.from('cases').select('id,reference').eq('id',caseId).single();
  if(caseError||!caseRecord)throw new Error('CASE_NOT_FOUND');
  const safeOriginalName=clean(file.name.replace(/[\r\n\\/]+/g,' '),180)||`documento.${extensions[file.type]}`;
  const hash=await sha256(bytes),storagePath=`${caseId}/internal/${crypto.randomUUID()}.${extensions[file.type]}`;
  const {error:uploadError}=await serviceClient.storage.from(BUCKET).upload(storagePath,bytes,{contentType:file.type,cacheControl:'0',upsert:false});
  if(uploadError)throw uploadError;
  try{
    const {data:document,error}=await serviceClient.from('case_internal_documents').insert({case_id:caseId,storage_path:storagePath,title,note,original_name:safeOriginalName,mime_type:file.type,size_bytes:file.size,sha256:hash,uploaded_by:admin.id}).select('id').single();
    if(error||!document)throw error||new Error('INTERNAL_DOCUMENT_UPLOAD_FAILED');
    await serviceClient.from('audit_events').insert({case_id:caseId,actor_id:admin.id,action:'internal_document_uploaded',object_type:'case_internal_document',object_id:document.id,details:{sha256:hash,mime_type:file.type,size_bytes:file.size,reference:caseRecord.reference}});
    return {documentId:document.id,sha256:hash};
  }catch(error){await serviceClient.storage.from(BUCKET).remove([storagePath]);throw error;}
}

async function downloadInternalDocument(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request),documentId=clean(input.documentId,36);
  if(!validUuid(documentId))throw new Error('INVALID_FIELDS');
  const {data:document,error}=await serviceClient.from('case_internal_documents').select('id,case_id,storage_path,original_name').eq('id',documentId).single();
  if(error||!document)throw new Error('INTERNAL_DOCUMENT_NOT_FOUND');
  const {data:signed,error:signedError}=await serviceClient.storage.from(BUCKET).createSignedUrl(document.storage_path,60,{download:document.original_name});
  if(signedError||!signed?.signedUrl)throw signedError||new Error('DOCUMENT_DOWNLOAD_FAILED');
  await serviceClient.from('audit_events').insert({case_id:document.case_id,actor_id:admin.id,action:'internal_document_download_link_created',object_type:'case_internal_document',object_id:document.id,details:{expires_in_seconds:60}});
  return {url:signed.signedUrl,expiresIn:60};
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  if(request.method!=='POST')return json(request,{error:'METHOD_NOT_ALLOWED'},405);
  try{
    const contentType=request.headers.get('content-type')||'';
    if(contentType.includes('multipart/form-data')){const form=await request.formData();if(form.get('action')!=='upload_internal_document')return json(request,{error:'UNKNOWN_ACTION'},400);return json(request,await uploadInternalDocument(request,form),201);}
    const input=await request.json();
    if(input.action==='download_internal_document')return json(request,await downloadInternalDocument(request,input));
    return json(request,{error:'UNKNOWN_ACTION'},400);
  }catch(error){return errorJson(request,error);}
});

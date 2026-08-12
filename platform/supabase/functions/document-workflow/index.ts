import {canAccessCase,requireAdmin,requireUser,serviceClient} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';
import {sendDocumentRequestEmail} from '../_shared/document-email.ts';
import {sendDocumentUploadEmail} from '../_shared/document-upload-email.ts';

const BUCKET='case-documents';
const MAX_BYTES=5*1024*1024;
const PRIVACY_VERSION='portal-documents-v1';
const allowedMimeTypes=new Set(['application/pdf','image/jpeg','image/png']);
const extensions:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function requireCaseAccess(request:Request,userId:string,caseId:string){
  if(!validUuid(caseId)||!await canAccessCase(userId,caseId))throw new Error('DOCUMENT_ACCESS_DENIED');
  const {data:profile,error}=await serviceClient.from('profiles').select('internal_role,active').eq('id',userId).single();
  if(error||!profile?.active)throw new Error('FORBIDDEN');
  if(profile.internal_role!=='client')await requireAdmin(request);
  return profile;
}

async function createRequest(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request);
  const caseId=clean(input.caseId,36),title=clean(input.title,120),instructions=clean(input.instructions,800);
  const requestType=clean(input.requestType,20)||'document';
  if(!validUuid(caseId)||title.length<3||!['document','clarification'].includes(requestType))throw new Error('INVALID_CLIENT_REQUEST');
  const {data:caseRecord,error:caseError}=await serviceClient.from('cases').select('client_id,client_name,status').eq('id',caseId).single();
  if(caseError||!caseRecord)throw new Error('CASE_NOT_FOUND');
  if(['closed','archived'].includes(caseRecord.status))throw new Error('CASE_CLOSED');
  const {data:requestId,error}=await serviceClient.rpc('server_create_client_request',{
    p_case_id:caseId,p_admin_id:admin.id,p_request_type:requestType,p_title:title,p_instructions:instructions
  });
  if(error)throw error;
  const {data:authUser}=await serviceClient.auth.admin.getUserById(caseRecord.client_id);
  const email=authUser?.user?.email||'';
  const emailSent=email?await sendDocumentRequestEmail({caseId,email,fullName:caseRecord.client_name,requestType}):false;
  return {requestId,emailSent,requestType};
}

async function submitClarification(request:Request,input:Record<string,unknown>){
  const user=await requireUser(request);
  const caseId=clean(input.caseId,36),requestId=clean(input.requestId,36),responseText=clean(input.responseText,4000);
  await requireCaseAccess(request,user.id,caseId);
  if(!validUuid(requestId)||responseText.length<2)throw new Error('INVALID_CLARIFICATION_RESPONSE');
  const {error}=await serviceClient.rpc('server_submit_clarification',{
    p_case_id:caseId,p_request_id:requestId,p_client_id:user.id,p_response_text:responseText
  });
  if(error)throw error;
  return {ok:true,status:'submitted'};
}

async function cancelRequest(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request);
  const requestId=clean(input.requestId,36);
  if(!validUuid(requestId))throw new Error('INVALID_CLIENT_REQUEST');
  const {error}=await serviceClient.rpc('server_cancel_client_request',{
    p_request_id:requestId,p_admin_id:admin.id
  });
  if(error)throw error;
  return {ok:true,status:'cancelled'};
}

async function uploadDocument(request:Request,form:FormData){
  const user=await requireUser(request);
  const caseId=clean(form.get('caseId'),36),requestId=clean(form.get('requestId'),36);
  await requireCaseAccess(request,user.id,caseId);
  if(!validUuid(requestId)||form.get('privacyNoticeAcknowledged')!=='true')throw new Error('PRIVACY_NOTICE_REQUIRED');
  const file=form.get('file');
  if(!(file instanceof File)||file.size<1||file.size>MAX_BYTES||!allowedMimeTypes.has(file.type))throw new Error('INVALID_DOCUMENT_FILE');
  const {data:documentRequest,error:requestError}=await serviceClient.from('document_requests')
    .select('id,status').eq('id',requestId).eq('case_id',caseId).single();
  if(requestError||!documentRequest||!['pending','submitted'].includes(documentRequest.status))throw new Error('DOCUMENT_REQUEST_UNAVAILABLE');

  const safeOriginalName=clean(file.name.replace(/[\r\n\\/]+/g,' '),180)||`documento.${extensions[file.type]}`;
  const storagePath=`${caseId}/${requestId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const {error:uploadError}=await serviceClient.storage.from(BUCKET).upload(storagePath,file,{
    contentType:file.type,cacheControl:'0',upsert:false
  });
  if(uploadError)throw uploadError;
  try{
    const {data:documentId,error}=await serviceClient.rpc('server_register_document_upload',{
      p_case_id:caseId,p_request_id:requestId,p_uploader_id:user.id,p_storage_path:storagePath,
      p_original_name:safeOriginalName,p_mime_type:file.type,p_size_bytes:file.size,
      p_privacy_notice_version:PRIVACY_VERSION
    });
    if(error)throw error;
    const {data:caseRecord}=await serviceClient.from('cases').select('reference').eq('id',caseId).single();
    const emailSent=caseRecord?.reference?await sendDocumentUploadEmail({caseId,reference:caseRecord.reference}):false;
    return {documentId,status:'uploaded',emailSent};
  }catch(error){
    await serviceClient.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
}

async function downloadDocument(request:Request,input:Record<string,unknown>){
  const user=await requireUser(request);
  const documentId=clean(input.documentId,36);
  if(!validUuid(documentId))throw new Error('INVALID_FIELDS');
  const {data:document,error}=await serviceClient.from('case_documents')
    .select('id,case_id,request_id,storage_path,original_name,status,deleted_at').eq('id',documentId).single();
  if(error||!document||document.deleted_at||document.status==='deleted')throw new Error('DOCUMENT_NOT_FOUND');
  await requireCaseAccess(request,user.id,document.case_id);
  const {data:signed,error:signedError}=await serviceClient.storage.from(BUCKET)
    .createSignedUrl(document.storage_path,60,{download:document.original_name});
  if(signedError||!signed?.signedUrl)throw signedError||new Error('DOCUMENT_DOWNLOAD_FAILED');
  await Promise.all([
    serviceClient.from('document_access_events').insert({
      case_id:document.case_id,request_id:document.request_id,document_id:document.id,
      actor_id:user.id,action:'download_link_created',details:{expires_in_seconds:60}
    }),
    serviceClient.from('audit_events').insert({
      case_id:document.case_id,actor_id:user.id,action:'document_download_link_created',
      object_type:'case_document',object_id:document.id,details:{expires_in_seconds:60}
    })
  ]);
  return {url:signed.signedUrl,expiresIn:60};
}

async function reviewDocument(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request);
  const documentId=clean(input.documentId,36),status=clean(input.status,20);
  if(!validUuid(documentId)||!['accepted','rejected'].includes(status))throw new Error('INVALID_DOCUMENT_STATUS');
  const {error}=await serviceClient.rpc('server_review_document',{
    p_document_id:documentId,p_admin_id:admin.id,p_status:status
  });
  if(error)throw error;
  return {ok:true,status};
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  if(request.method!=='POST')return json(request,{error:'METHOD_NOT_ALLOWED'},405);
  try{
    const contentType=request.headers.get('content-type')||'';
    if(contentType.includes('multipart/form-data')){
      const form=await request.formData();
      if(form.get('action')!=='upload_document')return json(request,{error:'UNKNOWN_ACTION'},400);
      return json(request,await uploadDocument(request,form),201);
    }
    const input=await request.json();
    if(input.action==='request_document')return json(request,await createRequest(request,input),201);
    if(input.action==='submit_clarification')return json(request,await submitClarification(request,input),201);
    if(input.action==='cancel_request')return json(request,await cancelRequest(request,input));
    if(input.action==='download_document')return json(request,await downloadDocument(request,input));
    if(input.action==='review_document')return json(request,await reviewDocument(request,input));
    return json(request,{error:'UNKNOWN_ACTION'},400);
  }catch(error){
    return errorJson(request,error);
  }
});

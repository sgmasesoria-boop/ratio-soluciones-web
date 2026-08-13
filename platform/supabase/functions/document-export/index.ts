import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';
import {buildBrandedDocument,safeDocumentFileName} from './document-builder.mjs';

const validUuid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const toBase64=(bytes:Uint8Array)=>{
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  return btoa(binary);
};

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  try{
    if(request.method!=='POST')return json(request,{error:'METHOD_NOT_ALLOWED'},405);
    const admin=await requireAdmin(request);
    const body=await request.json();
    const versionId=String(body.versionId||'');
    if(!validUuid(versionId))return json(request,{error:'INVALID_FIELDS'},400);
    const {data:version,error:versionError}=await serviceClient.from('case_document_versions')
      .select('id,working_document_id,version_number,status_label,change_summary,draft_content,created_at')
      .eq('id',versionId).single();
    if(versionError||!version)return json(request,{error:'DOCUMENT_NOT_FOUND'},404);
    const {data:working,error:workingError}=await serviceClient.from('case_working_documents')
      .select('id,case_id,title,document_type').eq('id',version.working_document_id).single();
    if(workingError||!working)return json(request,{error:'DOCUMENT_NOT_FOUND'},404);
    const {data:caseRecord,error:caseError}=await serviceClient.from('cases')
      .select('id,reference,client_name').eq('id',working.case_id).single();
    if(caseError||!caseRecord)return json(request,{error:'CASE_NOT_FOUND'},404);
    const content=String(version.draft_content||'').trim();
    if(!content)return json(request,{error:'DOCUMENT_CONTENT_EMPTY'},409);
    const dateLabel=new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date());
    const bytes=await buildBrandedDocument({
      title:working.title,documentType:working.document_type,reference:caseRecord.reference,
      clientName:caseRecord.client_name,versionNumber:version.version_number,
      statusLabel:version.status_label||'Borrador para revisión',dateLabel
    },content);
    const filename=safeDocumentFileName(working.title,caseRecord.reference,version.version_number);
    await serviceClient.from('audit_events').insert({
      case_id:caseRecord.id,actor_id:admin.id,action:'working_document_exported',
      object_type:'case_document_version',object_id:version.id,
      details:{format:'docx',filename,size_bytes:bytes.length,automatic_write:false}
    });
    return json(request,{filename,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',base64:toBase64(bytes)});
  }catch(error){return errorJson(request,error);}
});

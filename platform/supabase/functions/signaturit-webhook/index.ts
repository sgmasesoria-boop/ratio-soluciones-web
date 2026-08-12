import {serviceClient} from '../_shared/auth.ts';

const BUCKET='case-documents';
const MAX_EVENT_BYTES=64*1024,MAX_PDF_BYTES=15*1024*1024;
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validProviderId=(value:string)=>/^[A-Za-z0-9_-]{3,240}$/.test(value);

async function sha256(bytes:Uint8Array){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

function sameSecret(left:string,right:string){
  const a=new TextEncoder().encode(left),b=new TextEncoder().encode(right);
  if(a.length!==b.length)return false;let difference=0;
  for(let index=0;index<a.length;index++)difference|=a[index]^b[index];
  return difference===0;
}

function providerConfig(){
  const token=Deno.env.get('SIGNATURIT_ACCESS_TOKEN')||'';
  const webhookToken=Deno.env.get('SIGNATURIT_WEBHOOK_TOKEN')||'';
  const mode=(Deno.env.get('SIGNATURIT_MODE')||'sandbox').toLowerCase();
  const base=mode==='production'?'https://api.signaturit.com':'https://api.sandbox.signaturit.com';
  if(!token||webhookToken.length<32)throw new Error('NOT_CONFIGURED');
  return {token,webhookToken,base};
}

async function providerGet(url:string,token:string){
  const response=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('PROVIDER_ERROR');
  return response;
}

function jsonResponse(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});}

Deno.serve(async request=>{
  if(request.method!=='POST')return jsonResponse({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const config=providerConfig(),url=new URL(request.url);
    if(!sameSecret(url.searchParams.get('token')||'',config.webhookToken))return jsonResponse({error:'UNAUTHORIZED'},401);
    const declared=Number(request.headers.get('content-length')||0);
    if(declared>MAX_EVENT_BYTES)return jsonResponse({error:'PAYLOAD_TOO_LARGE'},413);
    const raw=await request.text();if(raw.length>MAX_EVENT_BYTES)return jsonResponse({error:'PAYLOAD_TOO_LARGE'},413);
    let payload:any;
    try{payload=JSON.parse(raw);}catch{return jsonResponse({error:'INVALID_JSON'},400);}
    const documentId=clean(payload?.document?.id,240),eventLabel=clean(payload?.type,200);
    if(!validProviderId(documentId)||!eventLabel)return jsonResponse({accepted:true,ignored:true},202);
    const {data:contract,error:contractError}=await serviceClient.from('case_contracts').select('id,case_id,provider_request_id,provider_document_id,signed_at').eq('provider','signaturit').eq('provider_document_id',documentId).maybeSingle();
    if(contractError)throw contractError;
    if(!contract)return jsonResponse({accepted:true,ignored:true},202);
    const payloadHash=await sha256(new TextEncoder().encode(raw));
    const occurredAt=Number.isFinite(Date.parse(payload?.created_at))?new Date(payload.created_at).toISOString():null;
    const eventId=`hook:${payloadHash}`;
    const {error:eventError}=await serviceClient.from('case_contract_signature_events').insert({contract_id:contract.id,provider:'signaturit',provider_event_id:eventId,event_label:eventLabel,payload_sha256:payloadHash,occurred_at:occurredAt});
    if(eventError&&eventError.code!=='23505')throw eventError;
    if(contract.signed_at)return jsonResponse({accepted:true,alreadyVerified:true});

    // El webhook solo despierta el proceso. La confirmacion procede de una
    // consulta autenticada a Signaturit, nunca de los campos recibidos aqui.
    const statusResponse=await providerGet(`${config.base}/v3/signatures/${encodeURIComponent(contract.provider_request_id)}.json`,config.token);
    const authoritative=await statusResponse.json();
    const document=authoritative?.documents?.find((item:any)=>item?.id===documentId);
    if(!document||document.status!=='completed')return jsonResponse({accepted:true,verified:false},202);

    const [signedResponse,evidenceResponse]=await Promise.all([
      providerGet(`${config.base}/v3/signatures/${encodeURIComponent(contract.provider_request_id)}/documents/${encodeURIComponent(documentId)}/download/signed`,config.token),
      providerGet(`${config.base}/v3/signatures/${encodeURIComponent(contract.provider_request_id)}/documents/${encodeURIComponent(documentId)}/download/audit_trail`,config.token)
    ]);
    const signed=new Uint8Array(await signedResponse.arrayBuffer()),evidence=new Uint8Array(await evidenceResponse.arrayBuffer());
    const isPdf=(bytes:Uint8Array)=>bytes.length>=5&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
    if(!isPdf(signed)||!isPdf(evidence)||signed.length>MAX_PDF_BYTES||evidence.length>MAX_PDF_BYTES)throw new Error('INVALID_PROVIDER_DOCUMENT');
    const signedHash=await sha256(signed),evidenceHash=await sha256(evidence);
    const signedPath=`${contract.case_id}/contracts/${contract.id}/${documentId}-signed.pdf`;
    const evidencePath=`${contract.case_id}/contracts/${contract.id}/${documentId}-evidence.pdf`;
    const first=await serviceClient.storage.from(BUCKET).upload(signedPath,signed,{contentType:'application/pdf',cacheControl:'0',upsert:false});
    if(first.error)throw first.error;
    const second=await serviceClient.storage.from(BUCKET).upload(evidencePath,evidence,{contentType:'application/pdf',cacheControl:'0',upsert:false});
    if(second.error){await serviceClient.storage.from(BUCKET).remove([signedPath]);throw second.error;}
    const providerSignedAt=document.events?.map((item:any)=>item?.type==='document_signed'||item?.type==='document_completed'?Date.parse(item?.created_at):NaN).filter((value:number)=>Number.isFinite(value)).sort((a:number,b:number)=>a-b)[0];
    const signedAt=Number.isFinite(providerSignedAt)?new Date(providerSignedAt).toISOString():occurredAt||new Date().toISOString();
    const {data:updated,error:updateError}=await serviceClient.from('case_contracts').update({signed_storage_path:signedPath,signed_sha256:signedHash,evidence_storage_path:evidencePath,evidence_sha256:evidenceHash,signed_at:signedAt}).eq('id',contract.id).is('signed_at',null).select('id').maybeSingle();
    if(updateError||!updated){await serviceClient.storage.from(BUCKET).remove([signedPath,evidencePath]);if(updateError)throw updateError;return jsonResponse({accepted:true,duplicate:true});}
    await Promise.all([
      serviceClient.from('case_events').insert({case_id:contract.case_id,event_type:'contract_signature_verified',title:'Firma del contrato acreditada',description:'El sistema ha verificado y archivado el contrato y su documento probatorio.',visibility:'internal',metadata:{contract_id:contract.id,provider:'signaturit'}}),
      serviceClient.from('audit_events').insert({case_id:contract.case_id,action:'contract_signature_verified',object_type:'case_contract',object_id:contract.id,details:{provider:'signaturit',signed_sha256:signedHash,evidence_sha256:evidenceHash}})
    ]);
    return jsonResponse({accepted:true,verified:true});
  }catch(error){console.error('Signaturit webhook failure',{error});return jsonResponse({error:'TEMPORARY_FAILURE'},503);}
});

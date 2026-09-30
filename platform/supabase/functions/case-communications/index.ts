import {requireAdmin,requireUser,serviceClient} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';
import {auditCommunicationEmail,notifyClientOfCommunicationResponse,notifyRatioOfCommunication} from '../_shared/communication-email.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value:unknown,max:number)=>String(value??'').replace(/\0/g,'').trim().slice(0,max);

async function requestCommunication(request:Request,input:Record<string,unknown>){
  const user=await requireUser(request);
  const caseId=clean(input.caseId,36),subject=clean(input.subject,140),message=clean(input.message,4000);
  const deadlineContext=clean(input.deadlineContext,1000),availabilityNote=clean(input.availabilityNote,500);
  if(!uuid.test(caseId)||subject.length<3||message.length<10)throw new Error('INVALID_COMMUNICATION_REQUEST');
  const {data:caseRecord,error:caseError}=await serviceClient.from('cases')
    .select('id,reference,client_id,portal_status,status,contract_confirmed_at').eq('id',caseId).single();
  if(caseError||!caseRecord)throw new Error('CASE_NOT_FOUND');
  if(caseRecord.client_id!==user.id||!['invited','active'].includes(caseRecord.portal_status)||!caseRecord.contract_confirmed_at)throw new Error('COMMUNICATION_ACCESS_DENIED');
  if(caseRecord.status!=='open')throw new Error('CASE_CLOSED');
  const {data:record,error}=await serviceClient.from('case_communication_requests').insert({
    case_id:caseId,requested_by:user.id,subject,message,deadline_context:deadlineContext,availability_note:availabilityNote
  }).select('id,created_at').single();
  if(error)throw error;
  const {data:admins}=await serviceClient.from('profiles').select('id').eq('internal_role','admin').eq('active',true);
  if(admins?.length)await serviceClient.from('notifications').insert(admins.map(admin=>({
    user_id:admin.id,case_id:caseId,notification_type:'client_communication',
    title:'Nueva solicitud de comunicación',body:`${caseRecord.reference} · Revisar en el CRM`
  })));
  await serviceClient.from('case_events').insert({
    case_id:caseId,event_type:'client_communication_requested',title:'Solicitud enviada a Ratio',
    description:subject,visibility:'client',actor_id:user.id,metadata:{communication_request_id:record.id}
  });
  const emailSent=await notifyRatioOfCommunication(caseId,caseRecord.reference);
  await auditCommunicationEmail(caseId,'communication_admin_email',emailSent);
  return {id:record.id,createdAt:record.created_at,emailSent};
}

async function respondCommunication(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request);
  const communicationId=clean(input.communicationId,36),responseText=clean(input.responseText,4000);
  if(!uuid.test(communicationId)||responseText.length<2)throw new Error('INVALID_COMMUNICATION_RESPONSE');
  const {data:communication,error:lookupError}=await serviceClient.from('case_communication_requests')
    .select('id,case_id,subject,responded_at').eq('id',communicationId).single();
  if(lookupError||!communication)throw new Error('COMMUNICATION_NOT_FOUND');
  if(communication.responded_at)throw new Error('COMMUNICATION_ALREADY_RESPONDED');
  const respondedAt=new Date().toISOString();
  const {error:updateError}=await serviceClient.from('case_communication_requests').update({
    response_text:responseText,responded_by:admin.id,responded_at:respondedAt
  }).eq('id',communicationId).is('responded_at',null);
  if(updateError)throw updateError;
  const {data:caseRecord}=await serviceClient.from('cases').select('client_id,client_name,contact_email').eq('id',communication.case_id).single();
  if(caseRecord?.client_id)await serviceClient.from('notifications').insert({
    user_id:caseRecord.client_id,case_id:communication.case_id,notification_type:'communication_response',
    title:'Respuesta a tu solicitud',body:communication.subject
  });
  await serviceClient.from('case_events').insert({
    case_id:communication.case_id,event_type:'client_communication_responded',title:'Ratio ha respondido a tu solicitud',
    description:communication.subject,visibility:'client',actor_id:admin.id,metadata:{communication_request_id:communication.id}
  });
  const emailSent=caseRecord?.contact_email?await notifyClientOfCommunicationResponse(communication.case_id,caseRecord.contact_email,caseRecord.client_name):false;
  await auditCommunicationEmail(communication.case_id,'communication_client_email',emailSent);
  return {respondedAt,emailSent};
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  if(request.method!=='POST')return json(request,{error:'METHOD_NOT_ALLOWED'},405);
  try{
    const input=await request.json();
    if(input.action==='request_communication')return json(request,await requestCommunication(request,input),201);
    if(input.action==='respond_communication')return json(request,await respondCommunication(request,input));
    return json(request,{error:'UNKNOWN_ACTION'},400);
  }catch(error){return errorJson(request,error);}
});



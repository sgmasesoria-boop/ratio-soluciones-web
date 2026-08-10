import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';
import {sendCaseConfirmation} from '../_shared/case-email.ts';

const statuses=['new','review','waiting','viable','proposal','contract','won','lost'];
const statusLabels:Record<string,string>={new:'Nueva',review:'En estudio',waiting:'Falta información',viable:'Viable',proposal:'Propuesta enviada',contract:'Contrato pendiente',won:'Contratada',lost:'No viable / cerrada'};
const categories=['Banca y financiación','Deudas y negociación','Vivienda','Familia','Seguros e indemnizaciones','Consumo','Otro asunto'];
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validEmail=(value:string)=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone=(value:string)=>!value||/^[0-9+() .-]{7,30}$/.test(value);
const validUuid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const leadStatusFlow=['new','review','waiting','viable','proposal','contract','won'];
const canAdvanceStatus=(current:string,next:string,convertedCaseId:string|null)=>current===next||(current==='won'?next==='lost'&&!convertedCaseId:current!=='lost'&&(next==='lost'||leadStatusFlow.indexOf(next)>leadStatusFlow.indexOf(current)));

async function findAuthUserByEmail(email:string){
  for(let page=1;page<=10;page++){
    const {data,error}=await serviceClient.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const user=data.users.find(item=>item.email?.toLowerCase()===email.toLowerCase());
    if(user)return user;
    if(data.users.length<1000)return null;
  }
  throw new Error('AUTH_USER_LOOKUP_LIMIT');
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  const respond=(body:unknown,status=200)=>json(request,body,status);
  if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const admin=await requireAdmin(request);
    const body=await request.json();
    if(body.action==='create_lead'){
      const fullName=clean(body.fullName,120),phone=clean(body.phone,30),email=clean(body.email,254).toLowerCase();
      const province=clean(body.province,80),category=clean(body.category,80),source=clean(body.source,80),summary=clean(body.summary,800);
      if(fullName.length<2||!phone||!email||!validPhone(phone)||!validEmail(email)||summary.length<10||!categories.includes(category)||body.privacyNoticeAcknowledged!==true)return respond({error:'INVALID_FIELDS'},400);
      const year=new Date().getUTCFullYear();
      const reference=`C-${year}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
      const {data,error}=await serviceClient.from('crm_leads').insert({
        reference,full_name:fullName,phone:phone||null,email:email||null,province:province||null,category,source,summary,
        status:'new',privacy_notice_at:new Date().toISOString(),privacy_version:'web-v3',
        legal_basis:'precontractual_request',created_by:admin.id
      }).select('id,reference').single();
      if(error)throw error;
      await serviceClient.from('audit_events').insert({actor_id:admin.id,action:'lead_created',object_type:'crm_lead',object_id:data.id,details:{source,contact_channels:['email','phone']}});
      return respond(data,201);
    }
    if(body.action==='update_lead'){
      const leadId=clean(body.leadId,36),status=clean(body.status,20),note=clean(body.note,800);
      const amount=Number(body.amount||0);
      const phone=clean(body.phone,30),email=clean(body.email,254).toLowerCase();
      if(!validUuid(leadId)||!statuses.includes(status)||!Number.isFinite(amount)||amount<0||!phone||!email||!validPhone(phone)||!validEmail(email))return respond({error:'INVALID_FIELDS'},400);
      const {data:previous,error:previousError}=await serviceClient.from('crm_leads').select('status,converted_case_id').eq('id',leadId).single();
      if(previousError||!previous)return respond({error:'LEAD_NOT_FOUND'},404);
      if(!canAdvanceStatus(previous.status,status,previous.converted_case_id))return respond({error:'STATUS_REGRESSION'},409);
      const {error}=await serviceClient.from('crm_leads').update({status,quoted_amount:amount,phone:phone||null,email:email||null}).eq('id',leadId);
      if(error)throw error;
      const history:Array<{lead_id:string,body:string,author_id:string}>=[];
      if(previous.status!==status)history.push({lead_id:leadId,body:`Estado cambiado de «${statusLabels[previous.status]||previous.status}» a «${statusLabels[status]||status}».`,author_id:admin.id});
      if(note)history.push({lead_id:leadId,body:note,author_id:admin.id});
      if(history.length){const {error:noteError}=await serviceClient.from('crm_lead_notes').insert(history);if(noteError)throw noteError;}
      await serviceClient.from('audit_events').insert({actor_id:admin.id,action:'lead_updated',object_type:'crm_lead',object_id:leadId,details:{previous_status:previous.status,status,status_changed:previous.status!==status}});
      return respond({ok:true});
    }
    if(body.action==='create_task'){
      const title=clean(body.title,180),dueDate=clean(body.dueDate,10),priority=body.priority==='high'?'high':'normal',leadId=clean(body.leadId,36);
      if(title.length<3||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!validUuid(leadId))return respond({error:'INVALID_FIELDS'},400);
      const {data,error}=await serviceClient.from('crm_tasks').insert({lead_id:leadId,title,due_on:dueDate,priority,assigned_to:admin.id,created_by:admin.id}).select('id').single();
      if(error)throw error;
      return respond(data,201);
    }
    if(body.action==='convert_lead'){
      const leadId=clean(body.leadId,36);
      if(!validUuid(leadId))return respond({error:'INVALID_FIELDS'},400);
      const {data:lead,error:leadError}=await serviceClient.from('crm_leads').select('email,full_name,status,converted_case_id').eq('id',leadId).single();
      if(leadError||!lead)return respond({error:'LEAD_NOT_FOUND'},404);
      if(lead.converted_case_id)return respond({error:'LEAD_ALREADY_CONVERTED'},409);
      if(lead.status!=='won')return respond({error:'LEAD_NOT_CONTRACTED'},409);
      if(!lead.email)return respond({error:'EMAIL_REQUIRED_FOR_PORTAL'},409);
      const redirectTo=Deno.env.get('CLIENT_PORTAL_URL')||'https://clientes.ratiosoluciones.es';
      const existingUser=await findAuthUserByEmail(lead.email);
      if(existingUser){
        const {data:profile,error:profileError}=await serviceClient.from('profiles').select('internal_role').eq('id',existingUser.id).maybeSingle();
        if(profileError)throw profileError;
        if(profile?.internal_role==='admin')return respond({error:'EMAIL_BELONGS_TO_INTERNAL_USER'},409);
      }
      let clientId=existingUser?.id||'';
      let invitedUserId='';
      if(!existingUser){
        const {data:invite,error:inviteError}=await serviceClient.auth.admin.inviteUserByEmail(lead.email,{redirectTo,data:{display_name:lead.full_name}});
        if(inviteError)throw inviteError;
        clientId=invite.user.id;
        invitedUserId=invite.user.id;
      }
      const reference=`RS-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
      const {data:caseId,error:caseError}=await serviceClient.rpc('server_convert_lead',{p_lead_id:leadId,p_client_id:clientId,p_admin_id:admin.id,p_reference:reference});
      if(caseError){if(invitedUserId)await serviceClient.auth.admin.deleteUser(invitedUserId);throw caseError;}
      const confirmationSent=await sendCaseConfirmation({caseId,reference,fullName:lead.full_name,email:lead.email,firstAccess:Boolean(invitedUserId)});
      return respond({caseId,reference,invitationSent:Boolean(invitedUserId),existingAccess:Boolean(existingUser),confirmationSent});
    }
    if(body.action==='resend_case_confirmation'){
      const leadId=clean(body.leadId,36);
      if(!validUuid(leadId))return respond({error:'INVALID_FIELDS'},400);
      const {data:lead,error:leadError}=await serviceClient.from('crm_leads').select('email,full_name,converted_case_id').eq('id',leadId).single();
      if(leadError||!lead)return respond({error:'LEAD_NOT_FOUND'},404);
      if(!lead.converted_case_id||!lead.email)return respond({error:'CASE_CONFIRMATION_UNAVAILABLE'},409);
      const {data:caseRecord,error:caseError}=await serviceClient.from('cases').select('reference').eq('id',lead.converted_case_id).single();
      if(caseError||!caseRecord)return respond({error:'CASE_NOT_FOUND'},404);
      const confirmationSent=await sendCaseConfirmation({caseId:lead.converted_case_id,reference:caseRecord.reference,fullName:lead.full_name,email:lead.email,firstAccess:false});
      if(!confirmationSent)return respond({error:'EMAIL_DELIVERY_FAILED'},502);
      return respond({ok:true,confirmationSent:true});
    }
    return respond({error:'UNKNOWN_ACTION'},400);
  }catch(error){
    return errorJson(request,error);
  }
});

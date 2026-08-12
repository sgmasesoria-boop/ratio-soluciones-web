import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';
import {sendCaseUpdateEmail} from '../_shared/case-update-email.ts';

const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  const respond=(body:unknown,status=200)=>json(request,body,status);
  if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const admin=await requireAdmin(request);
    const input=await request.json();
    const caseId=clean(input.caseId,50);
    const title=clean(input.title,120);
    const allowedStatuses=['open','study','action','response','resolution','closed'];
    if(!/^[0-9a-f-]{36}$/i.test(caseId)||title.length<3)return respond({error:'INVALID_FIELDS'},400);
    const {data:caseRecord,error:caseError}=await serviceClient.from('cases').select('status,client_id,client_name,reference,client_next_step').eq('id',caseId).single();
    if(caseError||!caseRecord)return respond({error:'CASE_NOT_FOUND'},404);
    if(!allowedStatuses.includes(caseRecord.status))return respond({error:'INVALID_CASE_STATUS'},409);
    const {data:eventId,error}=await serviceClient.rpc('server_update_case',{
      p_case_id:caseId,p_admin_id:admin.id,p_status:caseRecord.status,p_title:title,p_description:title,
      p_client_next_step:caseRecord.client_next_step||'',p_professional_name:clean(input.professionalName,120),
      p_professional_title:clean(input.professionalTitle,120),p_professional_registration:clean(input.professionalRegistration,160),
      p_professional_region:clean(input.professionalRegion,80)
    });
    if(error)throw error;
    const {data:authUser}=await serviceClient.auth.admin.getUserById(caseRecord.client_id);
    const email=authUser?.user?.email||'';
    const emailSent=email?await sendCaseUpdateEmail({caseId,reference:caseRecord.reference,fullName:caseRecord.client_name,email}):false;
    return respond({eventId,status:caseRecord.status,emailSent});
  }catch(error){
    return errorJson(request,error);
  }
});

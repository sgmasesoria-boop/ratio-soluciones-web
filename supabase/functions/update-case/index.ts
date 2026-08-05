import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {handleOptions,json} from '../_shared/http.ts';

const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const admin=await requireAdmin(request);
    const input=await request.json();
    const caseId=clean(input.caseId,50);
    const status=clean(input.status,30);
    const title=clean(input.title,120);
    const description=clean(input.description,600);
    const allowedStatuses=['open','study','action','response','resolution','closed'];
    if(!/^[0-9a-f-]{36}$/i.test(caseId)||!allowedStatuses.includes(status)||title.length<3||description.length<3)return json({error:'INVALID_FIELDS'},400);
    const {data:eventId,error}=await serviceClient.rpc('server_update_case',{
      p_case_id:caseId,p_admin_id:admin.id,p_status:status,p_title:title,p_description:description,
      p_client_next_step:clean(input.clientNextStep,400),p_professional_name:clean(input.professionalName,120),
      p_professional_title:clean(input.professionalTitle,120),p_professional_registration:clean(input.professionalRegistration,160),
      p_professional_region:clean(input.professionalRegion,80)
    });
    if(error)throw error;
    return json({eventId});
  }catch(error){
    const message=error instanceof Error?error.message:'UNKNOWN';
    return json({error:message},message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:500);
  }
});

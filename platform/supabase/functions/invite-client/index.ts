import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';

Deno.serve(async request=>{
  const options=handleOptions(request); if(options)return options;
  const respond=(body:unknown,status=200)=>json(request,body,status);
  if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const admin=await requireAdmin(request);
    const {email,displayName,title,category}=await request.json();
    const normalizedEmail=String(email||'').trim().toLowerCase();
    const normalizedName=String(displayName||'').trim();
    const normalizedTitle=String(title||'').trim();
    const allowedCategories=['Banca y financiación','Deudas y negociación','Vivienda','Familia','Seguros e indemnizaciones','Consumo','Otro asunto'];
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)||normalizedEmail.length>254||normalizedName.length<2||normalizedName.length>120||normalizedTitle.length<3||normalizedTitle.length>160||!allowedCategories.includes(category))return respond({error:'INVALID_FIELDS'},400);

    const redirectTo='https://clientes.ratiosoluciones.es';
    const {data:invite,error:inviteError}=await serviceClient.auth.admin.inviteUserByEmail(normalizedEmail,{redirectTo,data:{display_name:normalizedName}});
    if(inviteError)throw inviteError;
    const clientId=invite.user.id;
    const reference=`RS-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;

    const {data:caseId,error:caseError}=await serviceClient.rpc('server_create_invited_case',{p_client_id:clientId,p_display_name:normalizedName,p_admin_id:admin.id,p_reference:reference,p_title:normalizedTitle,p_category:category});
    if(caseError){await serviceClient.auth.admin.deleteUser(clientId);throw caseError;}
    return respond({caseId,reference});
  }catch(error){
    return errorJson(request,error);
  }
});

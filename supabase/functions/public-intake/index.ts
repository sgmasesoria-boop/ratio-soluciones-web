import {serviceClient} from '../_shared/auth.ts';
import nodemailer from 'npm:nodemailer@6.10.1';

const allowedOrigins=new Set([
  'https://www.ratiosoluciones.es',
  'https://ratiosoluciones.es',
  'https://ratio-soluciones-espana.sgmasesoria.chatgpt.site'
]);

const categoryMap:Record<string,string>={
  'Deudas y segunda oportunidad':'Deudas y negociación',
  'Bancos, tarjetas e hipotecas':'Banca y financiación',
  'Vivienda, alquiler u ocupación':'Vivienda',
  'Hacienda e impuestos':'Hacienda e impuestos',
  'Seguros e indemnizaciones':'Seguros e indemnizaciones',
  'Separación o familia':'Familia',
  'Consumo o servicios':'Consumo',
  'Otro problema':'Otro asunto'
};

const allowedSituations=new Set([
  'Acaba de ocurrir',
  'Ya he reclamado o negociado',
  'He recibido una respuesta',
  'He recibido una notificación formal',
  'Ya existe un procedimiento',
  'No estoy seguro'
]);

function headers(origin:string){
  return {
    ...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{}),
    'access-control-allow-headers':'apikey, content-type',
    'access-control-allow-methods':'POST, OPTIONS',
    'cache-control':'no-store',
    'content-type':'application/json; charset=utf-8',
    'x-content-type-options':'nosniff'
  };
}

function reply(origin:string,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:headers(origin)});
}

function clean(value:unknown,max:number){
  return typeof value==='string'?value.trim().slice(0,max):'';
}

function validEmail(value:string){
  return value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function reference(){
  const year=new Date().getUTCFullYear();
  return `C-${year}-${crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase()}`;
}

async function sendLeadNotification(lead:{id:string;reference:string;fullName:string;email:string;phone:string;category:string;situation:string}){
  const smtpPassword=Deno.env.get('RATIO_SMTP_PASSWORD');
  const smtpUser=Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
  const destination=Deno.env.get('RATIO_NOTIFICATION_EMAIL')||'clientes@ratiosoluciones.es';
  if(!smtpPassword){
    console.warn('Lead email notification skipped: RATIO_SMTP_PASSWORD is not configured');
    await serviceClient.from('audit_events').insert({
      actor_id:null,action:'lead_notification_skipped',object_type:'crm_lead',object_id:lead.id,details:{reason:'smtp_not_configured'}
    });
    return;
  }

  try{
    const transporter=nodemailer.createTransport({
      host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
      port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),
      secure:true,
      auth:{user:smtpUser,pass:smtpPassword}
    });
    await transporter.sendMail({
      from:`Ratio Soluciones <${smtpUser}>`,
      to:destination,
      replyTo:lead.email,
      subject:`Nueva consulta ${lead.reference}`,
      text:[
        `Se ha registrado una nueva consulta en el CRM.`,
        ``,
        `Referencia: ${lead.reference}`,
        `Nombre: ${lead.fullName.replace(/[\r\n]+/g,' ')}`,
        `Área: ${lead.category}`,
        `Situación: ${lead.situation}`,
        `Email: ${lead.email}`,
        `Teléfono: ${lead.phone}`,
        ``,
        `Consulta los detalles y gestiona el seguimiento dentro del CRM:`,
        `https://ratio-crm-privado.sgmasesoria.chatgpt.site/`,
        ``,
        `Este aviso no incluye la explicación libre ni documentación sensible.`
      ].join('\n')
    });
    await serviceClient.from('audit_events').insert({
      actor_id:null,action:'lead_notification_sent',object_type:'crm_lead',object_id:lead.id,details:{channel:'email',destination}
    });
  }catch(error){
    console.error('Lead email notification failed',{leadId:lead.id,error});
    await serviceClient.from('audit_events').insert({
      actor_id:null,action:'lead_notification_failed',object_type:'crm_lead',object_id:lead.id,details:{channel:'email'}
    });
  }
}

Deno.serve(async(request)=>{
  const origin=request.headers.get('origin')||'';
  if(!allowedOrigins.has(origin))return reply(origin,{error:'ORIGIN_NOT_ALLOWED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(request.method!=='POST')return reply(origin,{error:'METHOD_NOT_ALLOWED'},405);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reply(origin,{error:'INVALID_CONTENT_TYPE'},415);

  try{
    const raw=await request.text();
    if(raw.length>6000)return reply(origin,{error:'PAYLOAD_TOO_LARGE'},413);
    const body=JSON.parse(raw);
    const fullName=clean(body.fullName,100);
    const email=clean(body.email,160).toLowerCase();
    const phone=clean(body.phone,20);
    const area=clean(body.area,80);
    const situation=clean(body.situation,80);
    const consultation=clean(body.consultation,500);
    const honeypot=clean(body.website,200);

    if(honeypot)return reply(origin,{ok:true},201);
    if(fullName.length<2||!validEmail(email)||!/[0-9+() .-]{7,20}/.test(phone)||!categoryMap[area]||!allowedSituations.has(situation)||body.privacyNoticeAcknowledged!==true){
      return reply(origin,{error:'INVALID_SUBMISSION'},400);
    }

    const summary=`Situación indicada: ${situation}.${consultation?`\n\nConsulta: ${consultation}`:''}`;
    let created:{id:string;reference:string}|null=null;
    for(let attempt=0;attempt<2&&!created;attempt+=1){
      const {data,error}=await serviceClient.from('crm_leads').insert({
        reference:reference(),full_name:fullName,phone,email,category:categoryMap[area],source:'Formulario web',summary,
        status:'new',next_action:'Realizar primer contacto',privacy_notice_at:new Date().toISOString(),privacy_version:'web-v4',
        legal_basis:'precontractual_request',created_by:null
      }).select('id,reference').single();
      if(error&&error.code!=='23505')throw error;
      created=data;
    }
    if(!created)throw new Error('REFERENCE_COLLISION');
    await serviceClient.from('audit_events').insert({
      actor_id:null,action:'public_lead_created',object_type:'crm_lead',object_id:created.id,
      details:{source:'Formulario web',privacy_version:'web-v4',contact_channels:['email','phone']}
    });
    const notification=sendLeadNotification({
      id:created.id,reference:created.reference,fullName,email,phone,category:categoryMap[area],situation
    });
    const runtime=(globalThis as typeof globalThis&{EdgeRuntime?:{waitUntil(promise:Promise<unknown>):void}}).EdgeRuntime;
    if(runtime)runtime.waitUntil(notification);else await notification;
    return reply(origin,{ok:true,reference:created.reference},201);
  }catch(error){
    const requestId=crypto.randomUUID();
    console.error('Public intake error',{requestId,error});
    return reply(origin,{error:'INTERNAL_ERROR',requestId},500);
  }
});

import {serviceClient} from '../_shared/auth.ts';
import nodemailer from 'npm:nodemailer@6.10.1';

const allowedOrigins=new Set([
  'https://www.ratiosoluciones.es',
  'https://ratiosoluciones.es'
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

function safeHtml(value:string){
  return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]||character));
}

async function recordEmailAudit(leadId:string,action:string,details:Record<string,unknown>={}){
  await serviceClient.from('audit_events').insert({actor_id:null,action,object_type:'crm_lead',object_id:leadId,details});
}

async function sendLeadNotifications(lead:{id:string;reference:string;fullName:string;email:string;phone:string;category:string}){
  const smtpPassword=Deno.env.get('RATIO_SMTP_PASSWORD');
  const smtpUser=Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
  const destination=Deno.env.get('RATIO_NOTIFICATION_EMAIL')||'clientes@ratiosoluciones.es';
  if(!smtpPassword){
    console.warn('Lead email notification skipped: RATIO_SMTP_PASSWORD is not configured');
    await recordEmailAudit(lead.id,'lead_notification_skipped',{reason:'smtp_not_configured'});
    return;
  }

  const transporter=nodemailer.createTransport({
    host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
    port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),
    secure:true,
    auth:{user:smtpUser,pass:smtpPassword}
  });

  try{
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
        `Email: ${lead.email}`,
        `Teléfono: ${lead.phone}`,
        ``,
        `Consulta los detalles y gestiona el seguimiento dentro del CRM:`,
        `https://crm.ratiosoluciones.es/`,
        ``,
        `Este aviso no incluye la explicación libre ni documentación sensible.`
      ].join('\n')
    });
    await recordEmailAudit(lead.id,'lead_notification_sent',{channel:'email',destination});
  }catch(error){
    console.error('Lead email notification failed',{leadId:lead.id,error});
    await recordEmailAudit(lead.id,'lead_notification_failed',{channel:'email'});
  }

  try{
    const customerName=safeHtml(lead.fullName.replace(/[\r\n]+/g,' '));
    const customerReference=safeHtml(lead.reference);
    await transporter.sendMail({
      from:`Ratio Soluciones <${smtpUser}>`,
      to:lead.email,
      replyTo:smtpUser,
      subject:`Ratio Soluciones | Hemos recibido tu consulta ${lead.reference}`,
      text:[
        `Hola ${lead.fullName.replace(/[\r\n]+/g,' ')},`,
        ``,
        `Hemos recibido correctamente tu consulta en Ratio Soluciones.`,
        ``,
        `Referencia: ${lead.reference}`,
        ``,
        `Nuestro equipo revisará la información y se pondrá en contacto contigo utilizando el correo y el teléfono que nos has facilitado.`,
        ``,
        `Este mensaje confirma únicamente la recepción de la consulta; todavía no supone la aceptación del asunto ni la contratación de ningún servicio.`,
        ``,
        `Por tu seguridad, no envíes documentación sensible por correo electrónico. Si necesitamos ampliar información, te indicaremos cómo continuar.`,
        ``,
        `Ratio Soluciones`,
        `clientes@ratiosoluciones.es`
      ].join('\n'),
      html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#10231e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f5f2"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 28px;background:#0b2e25;color:#fff"><strong style="font-size:20px">RATIO <span style="color:#d9ff68">SOLUCIONES</span></strong></td></tr><tr><td style="padding:30px 28px"><p>Hola ${customerName},</p><h1 style="font-size:25px">Hemos recibido tu consulta</h1><p style="line-height:1.6;color:#51635d">La consulta ha quedado registrada correctamente. Nuestro equipo revisará la información y se pondrá en contacto contigo utilizando los datos que nos has facilitado.</p><p style="padding:14px;border-radius:9px;background:#edf3f0"><strong>Referencia: ${customerReference}</strong></p><p style="line-height:1.6;color:#51635d">Este mensaje confirma únicamente la recepción. Todavía no supone la aceptación del asunto ni la contratación de ningún servicio.</p><p style="font-size:12px;line-height:1.6;color:#71817b"><strong>Por tu seguridad, no envíes documentación sensible por correo electrónico.</strong> Si necesitamos ampliar información, te indicaremos cómo continuar.</p></td></tr><tr><td style="padding:17px 28px;background:#edf3f0;font-size:11px;color:#71817b">Ratio Soluciones · clientes@ratiosoluciones.es</td></tr></table></td></tr></table></body></html>`
    });
    await recordEmailAudit(lead.id,'lead_receipt_sent',{channel:'email'});
  }catch(error){
    console.error('Lead customer receipt failed',{leadId:lead.id,error});
    await recordEmailAudit(lead.id,'lead_receipt_failed',{channel:'email'});
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
    const consultation=clean(body.consultation,800);
    const honeypot=clean(body.website,200);

    if(honeypot)return reply(origin,{error:'SUBMISSION_REJECTED'},400);
    if(fullName.length<2||!validEmail(email)||!/[0-9+() .-]{7,20}/.test(phone)||!categoryMap[area]||consultation.length<10||body.privacyNoticeAcknowledged!==true){
      return reply(origin,{error:'INVALID_SUBMISSION'},400);
    }

    const summary=consultation;
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
    const notification=sendLeadNotifications({
      id:created.id,reference:created.reference,fullName,email,phone,category:categoryMap[area]
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

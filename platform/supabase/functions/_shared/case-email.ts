import nodemailer from 'npm:nodemailer@6.10.1';
import {serviceClient} from './auth.ts';

type CaseConfirmation={
  caseId:string;
  reference:string;
  fullName:string;
  email:string;
  firstAccess:boolean;
};

function safeHtml(value:string){
  return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]||character));
}

async function audit(message:CaseConfirmation,action:string,details:Record<string,unknown>={}){
  await serviceClient.from('audit_events').insert({
    actor_id:null,case_id:message.caseId,action,object_type:'case',object_id:message.caseId,details
  });
}

export async function sendCaseConfirmation(message:CaseConfirmation){
  const smtpPassword=Deno.env.get('RATIO_SMTP_PASSWORD');
  const smtpUser=Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
  const portalUrl='https://clientes.ratiosoluciones.es';
  if(!smtpPassword){
    console.warn('Case confirmation skipped: RATIO_SMTP_PASSWORD is not configured',{caseId:message.caseId});
    await audit(message,'case_confirmation_skipped',{reason:'smtp_not_configured'});
    return false;
  }

  const transporter=nodemailer.createTransport({
    host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
    port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),
    secure:true,
    auth:{user:smtpUser,pass:smtpPassword}
  });
  const cleanName=message.fullName.replace(/[\r\n]+/g,' ');
  const accessText=message.firstAccess
    ?'También recibirás un correo de invitación para confirmar tu cuenta y crear la contraseña. Después podrás entrar en la plataforma privada.'
    :'Tu acceso anterior sigue siendo válido. Puedes entrar en la plataforma privada con tu correo y contraseña habituales.';
  try{
    await transporter.sendMail({
      from:`Ratio Soluciones <${smtpUser}>`,
      to:message.email,
      replyTo:smtpUser,
      subject:`Ratio Soluciones | Tu expediente ${message.reference} ya está abierto`,
      text:[
        `Hola ${cleanName},`,'',
        'Tu expediente ya está abierto en Ratio Soluciones.', '',
        `Referencia: ${message.reference}`,'',accessText,'',
        `Acceso: ${portalUrl}`,'',
        'Dentro de la plataforma podrás consultar los avances y lo que necesitemos de ti.',
        'Por tu seguridad, no envíes documentación sensible por correo electrónico.','',
        'Ratio Soluciones',smtpUser
      ].join('\n'),
      html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#10231e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f5f2"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 28px;background:#0b2e25;color:#fff"><strong style="font-size:20px">RATIO <span style="color:#d9ff68">SOLUCIONES</span></strong></td></tr><tr><td style="padding:30px 28px"><p>Hola ${safeHtml(cleanName)},</p><h1 style="font-size:25px">Tu expediente ya está abierto</h1><p style="line-height:1.6;color:#51635d">Hemos creado tu expediente en Ratio Soluciones.</p><p style="padding:14px;border-radius:9px;background:#edf3f0"><strong>Referencia: ${safeHtml(message.reference)}</strong></p><p style="line-height:1.6;color:#51635d">${safeHtml(accessText)}</p><p style="margin:26px 0"><a href="${safeHtml(portalUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#0b2e25;color:#fff;text-decoration:none;font-weight:bold">Acceder a mi expediente</a></p><p style="line-height:1.6;color:#51635d">Dentro de la plataforma podrás consultar los avances y lo que necesitemos de ti.</p><p style="font-size:12px;line-height:1.6;color:#71817b"><strong>Por tu seguridad, no envíes documentación sensible por correo electrónico.</strong></p></td></tr><tr><td style="padding:17px 28px;background:#edf3f0;font-size:11px;color:#71817b">Ratio Soluciones · ${safeHtml(smtpUser)}</td></tr></table></td></tr></table></body></html>`
    });
    await audit(message,'case_confirmation_sent',{channel:'email',first_access:message.firstAccess});
    return true;
  }catch(error){
    console.error('Case confirmation failed',{caseId:message.caseId,error});
    await audit(message,'case_confirmation_failed',{channel:'email',first_access:message.firstAccess});
    return false;
  }
}

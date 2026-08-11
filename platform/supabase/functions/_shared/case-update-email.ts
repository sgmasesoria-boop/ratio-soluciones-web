import nodemailer from 'npm:nodemailer@6.10.1';
import {serviceClient} from './auth.ts';

type CaseUpdateEmail={
  caseId:string;
  reference:string;
  fullName:string;
  email:string;
};

function safeHtml(value:string){
  return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]||character));
}

async function audit(message:CaseUpdateEmail,action:string,details:Record<string,unknown>={}){
  await serviceClient.from('audit_events').insert({
    actor_id:null,case_id:message.caseId,action,object_type:'case',object_id:message.caseId,details
  });
}

export async function sendCaseUpdateEmail(message:CaseUpdateEmail){
  const smtpPassword=Deno.env.get('RATIO_SMTP_PASSWORD');
  const smtpUser=Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
  const portalUrl='https://clientes.ratiosoluciones.es';
  if(!smtpPassword){
    await audit(message,'case_update_email_skipped',{reason:'smtp_not_configured'});
    return false;
  }

  const transporter=nodemailer.createTransport({
    host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
    port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),
    secure:true,
    auth:{user:smtpUser,pass:smtpPassword}
  });
  const cleanName=message.fullName.replace(/[\r\n]+/g,' ').trim();
  try{
    await transporter.sendMail({
      from:`Ratio Soluciones <${smtpUser}>`,
      to:message.email,
      replyTo:smtpUser,
      subject:`Ratio Soluciones | Nuevo avance en tu expediente ${message.reference}`,
      text:[
        `Hola ${cleanName},`,'',
        'Hemos registrado una nueva actualización en tu expediente.','',
        `Referencia: ${message.reference}`,
        `Acceso seguro: ${portalUrl}`,'',
        'Consulta el detalle dentro de tu plataforma privada. Por seguridad, este correo no incluye información del expediente.','',
        'Ratio Soluciones',smtpUser
      ].join('\n'),
      html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#10231e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f5f2"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 28px;background:#0b2e25;color:#fff"><strong style="font-size:20px">RATIO <span style="color:#d9ff68">SOLUCIONES</span></strong></td></tr><tr><td style="padding:30px 28px"><p>Hola ${safeHtml(cleanName)},</p><h1 style="font-size:25px">Hay un nuevo avance en tu expediente</h1><p style="line-height:1.6;color:#51635d">Hemos registrado una nueva actualización en tu expediente.</p><p style="padding:14px;border-radius:9px;background:#edf3f0"><strong>Referencia: ${safeHtml(message.reference)}</strong></p><p style="margin:26px 0"><a href="${safeHtml(portalUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#0b2e25;color:#fff;text-decoration:none;font-weight:bold">Consultar mi expediente</a></p><p style="font-size:12px;line-height:1.6;color:#71817b"><strong>Por seguridad, este correo no incluye información del expediente.</strong></p></td></tr><tr><td style="padding:17px 28px;background:#edf3f0;font-size:11px;color:#71817b">Ratio Soluciones · ${safeHtml(smtpUser)}</td></tr></table></td></tr></table></body></html>`
    });
    await audit(message,'case_update_email_sent',{channel:'email'});
    return true;
  }catch(error){
    console.error('Case update email failed',{caseId:message.caseId,error});
    await audit(message,'case_update_email_failed',{channel:'email'});
    return false;
  }
}

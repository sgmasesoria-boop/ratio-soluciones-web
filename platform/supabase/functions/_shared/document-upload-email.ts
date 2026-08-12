import nodemailer from 'npm:nodemailer@6.10.1';
import {serviceClient} from './auth.ts';

type DocumentUploadEmail={
  caseId:string;
  reference:string;
};

function safeHtml(value:string){
  return value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]||character));
}

async function audit(message:DocumentUploadEmail,action:string,details:Record<string,unknown>={}){
  const {error}=await serviceClient.from('audit_events').insert({
    case_id:message.caseId,actor_id:null,action,
    object_type:'case',object_id:message.caseId,details
  });
  if(error)console.error('Document upload email audit failed',{caseId:message.caseId,action,error});
}

export async function sendDocumentUploadEmail(message:DocumentUploadEmail){
  const smtpPassword=Deno.env.get('RATIO_SMTP_PASSWORD');
  const smtpUser=Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
  const recipient=Deno.env.get('RATIO_INTERNAL_NOTIFICATION_EMAIL')||smtpUser;
  const crmUrl='https://crm.ratiosoluciones.es';
  if(!smtpPassword){
    await audit(message,'document_upload_email_skipped',{reason:'smtp_not_configured'});
    return false;
  }

  const transporter=nodemailer.createTransport({
    host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
    port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),
    secure:true,
    auth:{user:smtpUser,pass:smtpPassword}
  });
  const reference=message.reference.replace(/[\r\n]+/g,' ').trim();
  try{
    await transporter.sendMail({
      from:`Ratio Soluciones <${smtpUser}>`,
      to:recipient,
      replyTo:smtpUser,
      subject:`Ratio Soluciones | Nueva documentación recibida · ${reference}`,
      text:[
        'Se ha recibido nueva documentación en la plataforma privada.','',
        `Expediente: ${reference}`,
        `Acceso al CRM: ${crmUrl}`,'',
        'El correo no contiene archivos ni datos sensibles. Revisa la entrega dentro del CRM.','',
        'Ratio Soluciones'
      ].join('\n'),
      html:`<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#10231e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#f4f5f2"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 28px;background:#0b2e25;color:#fff"><strong style="font-size:20px">RATIO <span style="color:#d9ff68">SOLUCIONES</span></strong></td></tr><tr><td style="padding:30px 28px"><h1 style="font-size:25px">Nueva documentación recibida</h1><p style="line-height:1.6;color:#51635d">Se ha registrado una entrega en el expediente <strong>${safeHtml(reference)}</strong>.</p><p style="margin:26px 0"><a href="${safeHtml(crmUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#0b2e25;color:#fff;text-decoration:none;font-weight:bold">Revisar en el CRM</a></p><p style="font-size:12px;line-height:1.6;color:#71817b">Este correo no contiene archivos ni datos sensibles. La documentación solo está disponible dentro del CRM privado.</p></td></tr><tr><td style="padding:17px 28px;background:#edf3f0;font-size:11px;color:#71817b">Ratio Soluciones · ${safeHtml(smtpUser)}</td></tr></table></td></tr></table></body></html>`
    });
    await audit(message,'document_upload_email_sent',{channel:'email',recipient:'internal'});
    return true;
  }catch(error){
    console.error('Document upload email failed',{caseId:message.caseId,error});
    await audit(message,'document_upload_email_failed',{channel:'email',recipient:'internal'});
    return false;
  }
}

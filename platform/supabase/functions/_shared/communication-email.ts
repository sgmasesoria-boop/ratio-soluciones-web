import nodemailer from 'npm:nodemailer@6.10.1';
import {serviceClient} from './auth.ts';

const smtpUser=()=>Deno.env.get('RATIO_SMTP_USER')||'clientes@ratiosoluciones.es';
const portalUrl='https://clientes.ratiosoluciones.es';

async function transporter(){
  const password=Deno.env.get('RATIO_SMTP_PASSWORD');
  if(!password)return null;
  return nodemailer.createTransport({
    host:Deno.env.get('RATIO_SMTP_HOST')||'smtp.serviciodecorreo.es',
    port:Number(Deno.env.get('RATIO_SMTP_PORT')||'465'),secure:true,
    auth:{user:smtpUser(),pass:password}
  });
}

export async function notifyRatioOfCommunication(caseId:string,reference:string){
  const transport=await transporter();
  if(!transport)return false;
  try{
    await transport.sendMail({
      encoding:'base64',
      from:`Ratio Soluciones <${smtpUser()}>`,to:smtpUser(),replyTo:smtpUser(),
      subject:`Ratio Soluciones | Nueva solicitud en ${reference}`,
      text:`Hay una nueva solicitud de comunicación en el expediente ${reference}.\n\nRevísala dentro del CRM privado.\n\nhttps://crm.ratiosoluciones.es`
    });
    return true;
  }catch(error){
    console.error('Communication admin email failed',{caseId,error});return false;
  }
}

export async function notifyClientOfCommunicationResponse(caseId:string,email:string,fullName:string){
  const transport=await transporter();
  if(!transport)return false;
  const cleanName=fullName.replace(/[\r\n]+/g,' ').trim();
  try{
    await transport.sendMail({
      encoding:'base64',
      from:`Ratio Soluciones <${smtpUser()}>`,to:email,replyTo:smtpUser(),
      subject:'Ratio Soluciones | Hemos respondido en tu plataforma privada',
      text:`Hola ${cleanName},\n\nHemos respondido a tu solicitud dentro de tu expediente.\n\nAccede de forma segura: ${portalUrl}\n\nPor seguridad, no respondas a este correo con documentación.\n\nRatio Soluciones`
    });
    return true;
  }catch(error){
    console.error('Communication client email failed',{caseId,error});return false;
  }
}

export async function auditCommunicationEmail(caseId:string,action:string,sent:boolean){
  await serviceClient.from('audit_events').insert({
    case_id:caseId,actor_id:null,action:`${action}_${sent?'sent':'failed'}`,
    object_type:'case',object_id:caseId,details:{channel:'email'}
  });
}


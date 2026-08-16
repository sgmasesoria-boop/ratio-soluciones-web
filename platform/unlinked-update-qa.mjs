import {readFile} from 'node:fs/promises';

const edge=await readFile('supabase/functions/update-case/index.ts','utf8');
const app=await readFile('app.js','utf8');
const html=await readFile('index.html','utf8');
const failures=[];

if(!edge.includes("caseRecord.client_id&&['invited','active'].includes(caseRecord.portal_status)")){
  failures.push('La función sigue intentando consultar Auth para expedientes sin cuenta de cliente o sin portal activo.');
}
if(!edge.includes("notificationStatus:'sent'|'failed'|'skipped'")){
  failures.push('La función no distingue entre aviso enviado, fallido y omitido.');
}
if(!edge.includes("const allowedStatuses=['open']")){
  failures.push('La función admite estados cerrados o estados antiguos que ya no existen.');
}
if(!html.includes('id="update-submit"')){
  failures.push('El botón del formulario no puede adaptar su texto al estado del portal.');
}
if(!app.includes("'Guardar avance <span>→</span>'")){
  failures.push('El CRM sigue prometiendo una notificación cuando el portal aún no está activo.');
}
if(!app.includes('El portal del cliente todavía no está activado')){
  failures.push('Falta la confirmación clara para expedientes sin portal.');
}

console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;

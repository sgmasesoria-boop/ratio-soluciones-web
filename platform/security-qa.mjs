import { readFile } from 'node:fs/promises';

const migration=await readFile('supabase/migrations/005_security_and_minimization.sql','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const auth=await readFile('supabase/functions/_shared/auth.ts','utf8');
const crm=await readFile('supabase/functions/manage-crm/index.ts','utf8');
const inviteClient=await readFile('supabase/functions/invite-client/index.ts','utf8');
const caseEmail=await readFile('supabase/functions/_shared/case-email.ts','utf8');
const documentEmail=await readFile('supabase/functions/_shared/document-email.ts','utf8');
const documentUploadEmail=await readFile('supabase/functions/_shared/document-upload-email.ts','utf8');
const updateCase=await readFile('supabase/functions/update-case/index.ts','utf8');
const caseUpdateEmail=await readFile('supabase/functions/_shared/case-update-email.ts','utf8');
const publicIntake=await readFile('supabase/functions/public-intake/index.ts','utf8');
const config=await readFile('supabase/config.toml','utf8');
const api=await readFile('platform-api.js','utf8');
const app=await readFile('app.js','utf8');
const build=await readFile('build.mjs','utf8');
const builtWorker=await readFile('dist/server/index.js','utf8');
const authHardening=await readFile('supabase/migrations/007_auth_and_data_api_hardening.sql','utf8');
const mfaMigration=await readFile('supabase/migrations/20260808232753_require_internal_mfa.sql','utf8');
const internalReadMfaMigration=await readFile('supabase/migrations/20260814224205_require_mfa_for_internal_case_reads.sql','utf8');
const html=await readFile('index.html','utf8');
const failures=[];

for(const policy of ['cases_manage_authorized','members_admin_write','events_manage_authorized','crm_leads_admin_all']){
  if(!migration.includes(`drop policy if exists ${policy}`))failures.push(`No se elimina la política amplia ${policy}`);
}
if(!migration.includes('grant update(read_at) on public.notifications'))failures.push('Las notificaciones no limitan la edición a read_at.');
if(!migration.includes('members_read_internal'))failures.push('La lista interna de miembros sigue visible para clientes.');
const contactMigration=await readFile('supabase/migrations/006_require_email_and_phone.sql','utf8');
if(!contactMigration.includes('alter column phone set not null')||!contactMigration.includes('alter column email set not null'))failures.push('El CRM no exige email y teléfono.');
if(!migration.includes('assert_active_admin'))failures.push('Las funciones SQL no verifican el administrador actor.');
if(!http.includes('https://crm.ratiosoluciones.es')||!http.includes('https://clientes.ratiosoluciones.es'))failures.push('CORS no contempla CRM y portal.');
if(!config.includes('site_url = "https://clientes.ratiosoluciones.es"'))failures.push('Supabase conserva el portal temporal como URL principal.');
if(!publicIntake.includes('https://crm.ratiosoluciones.es/'))failures.push('Los avisos de consultas siguen enlazando al CRM temporal.');
for(const [name,source] of [['invite-client',inviteClient],['manage-crm',crm],['case-email',caseEmail],['document-email',documentEmail]]){
  if(!source.includes('https://clientes.ratiosoluciones.es'))failures.push(`${name} no enlaza al portal corporativo.`);
  if(source.includes("Deno.env.get('CLIENT_PORTAL_URL')"))failures.push(`${name} permite que una variable antigua sustituya el portal corporativo.`);
  if(source.includes('ratio-portal-pruebas.sgmasesoria.chatgpt.site'))failures.push(`${name} conserva el portal provisional.`);
}
if(!updateCase.includes('sendCaseUpdateEmail')||!updateCase.includes('emailSent'))failures.push('Los avances del expediente no notifican al cliente por correo.');
if(!caseUpdateEmail.includes("'case_update_email_sent'")||!caseUpdateEmail.includes('https://clientes.ratiosoluciones.es'))failures.push('El correo de avances no deja auditoría o no enlaza al portal corporativo.');
if(!documentUploadEmail.includes("'document_upload_email_sent'")||!documentUploadEmail.includes('https://crm.ratiosoluciones.es'))failures.push('La entrega documental no avisa por correo al canal interno.');
if(http.includes("return json(request,{error:message}"))failures.push('Las funciones exponen errores internos.');
if(!crm.includes("privacy_notice_at")||crm.includes("consent_at"))failures.push('El CRM no distingue información de privacidad y consentimiento.');
for(const functionName of ['invite-client','update-case','manage-crm']){
  const block=new RegExp(`\\[functions\\.${functionName}\\]\\s*verify_jwt = false`);
  if(!block.test(config))failures.push(`${functionName} conserva el verificador JWT antiguo incompatible con claves asimétricas.`);
}
if(!auth.includes('await requireUser(request)')||!auth.includes("data.internal_role!=='admin'"))failures.push('Las funciones privadas no validan internamente la sesión y el rol administrador.');
if(!api.includes("this.appMode !== 'portal'"))failures.push('El portal sigue consultando tablas internas del CRM.');
if(!build.includes("['/app','/restablecer']"))failures.push('Las rutas autenticada y de recuperación no llegan a la aplicación.');
if(!build.includes("dynamic?'no-store'"))failures.push('HTML y JavaScript pueden conservar una versión antigua del acceso MFA.');
if(!build.includes("'strict-transport-security':'max-age=31536000; includeSubDomains'"))failures.push('CRM y portal no fuerzan HSTS.');
if(!build.includes("'cross-origin-opener-policy':'same-origin'"))failures.push('CRM y portal no aíslan el contexto de navegación.');
if(!builtWorker.includes("connect-src 'self' https://bvpeztdfwdbiielaione.supabase.co")||builtWorker.includes("connect-src 'self' https://*.supabase.co"))failures.push('La política CSP permite conexiones a proyectos Supabase ajenos a Ratio.');
if(!builtWorker.includes("object-src 'none'"))failures.push('La política CSP no bloquea objetos embebidos.');
if(!authHardening.includes('revoke all privileges on all tables in schema public from anon, authenticated'))failures.push('La Data API conserva privilegios amplios por defecto.');
if(!authHardening.includes('grant update (read_at) on public.notifications to authenticated'))failures.push('El usuario autenticado no puede marcar sus avisos como leídos.');
if(!authHardening.includes('revoke execute on function public.rls_auto_enable() from public, anon, authenticated'))failures.push('La función de activación RLS sigue expuesta por RPC.');

if(!auth.includes("assuranceLevel(request)!=='aal2'")||!http.includes("message==='MFA_REQUIRED'"))failures.push('Las funciones internas no exigen una sesión MFA AAL2.');
if(!mfaMigration.includes("auth.jwt()->>'aal','aal1')='aal2'"))failures.push('RLS no exige AAL2 para el personal interno.');
if(!internalReadMfaMigration.includes("coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'")||!internalReadMfaMigration.includes('from public.case_members'))failures.push('La lectura de expedientes por miembros internos no exige AAL2.');
if(!html.includes('id="mfa-dialog"')||!api.includes('async enrollTotp')||!api.includes('async verifyMfa'))failures.push('El CRM no incluye el flujo completo de alta y verificación MFA.');
if(!api.includes("password.length >= 12")||!api.includes("/[A-ZÁÉÍÓÚÜÑ]/")||!api.includes("/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\\s]/"))failures.push('El alta no exige una contraseña robusta con longitud y complejidad.');
if(!html.includes('mayúscula, minúscula, número y símbolo'))failures.push('La interfaz no explica al cliente los requisitos de contraseña.');
if(/[ÃÂ]|â†/.test(html)||/[ÃÂ]|â†/.test(app))failures.push('La interfaz MFA contiene texto con codificación incorrecta.');
if(!app.includes("qr.includes('<svg')")||!app.includes('data:image/svg+xml;charset=utf-8')||!app.includes("startsWith('otpauth://')"))failures.push('El alta MFA no cubre los formatos QR y URI de Supabase.');
const result={passed:failures.length===0,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;

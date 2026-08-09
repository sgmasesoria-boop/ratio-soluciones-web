import { readFile } from 'node:fs/promises';

const migration=await readFile('supabase/migrations/005_security_and_minimization.sql','utf8');
const http=await readFile('supabase/functions/_shared/http.ts','utf8');
const auth=await readFile('supabase/functions/_shared/auth.ts','utf8');
const crm=await readFile('supabase/functions/manage-crm/index.ts','utf8');
const config=await readFile('supabase/config.toml','utf8');
const api=await readFile('platform-api.js','utf8');
const app=await readFile('app.js','utf8');
const build=await readFile('build.mjs','utf8');
const authHardening=await readFile('supabase/migrations/007_auth_and_data_api_hardening.sql','utf8');
const mfaMigration=await readFile('supabase/migrations/20260808232753_require_internal_mfa.sql','utf8');
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
if(!authHardening.includes('revoke all privileges on all tables in schema public from anon, authenticated'))failures.push('La Data API conserva privilegios amplios por defecto.');
if(!authHardening.includes('grant update (read_at) on public.notifications to authenticated'))failures.push('El usuario autenticado no puede marcar sus avisos como leídos.');
if(!authHardening.includes('revoke execute on function public.rls_auto_enable() from public, anon, authenticated'))failures.push('La función de activación RLS sigue expuesta por RPC.');

if(!auth.includes("assuranceLevel(request)!=='aal2'")||!http.includes("message==='MFA_REQUIRED'"))failures.push('Las funciones internas no exigen una sesión MFA AAL2.');
if(!mfaMigration.includes("auth.jwt()->>'aal','aal1')='aal2'"))failures.push('RLS no exige AAL2 para el personal interno.');
if(!html.includes('id="mfa-dialog"')||!api.includes('async enrollTotp')||!api.includes('async verifyMfa'))failures.push('El CRM no incluye el flujo completo de alta y verificación MFA.');
if(/[ÃÂ]|â†/.test(html)||/[ÃÂ]|â†/.test(app))failures.push('La interfaz MFA contiene texto con codificación incorrecta.');
if(!app.includes("startsWith('<svg')")||!app.includes('data:image/svg+xml;charset=utf-8'))failures.push('El QR SVG de Supabase no se convierte en una URL de imagen válida.');
const result={passed:failures.length===0,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exitCode=1;

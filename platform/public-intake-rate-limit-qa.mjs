import { readFile } from 'node:fs/promises';

const migration=await readFile('supabase/migrations/20260815001500_public_intake_rate_limits.sql','utf8');
const bootstrap=await readFile('supabase/bootstrap.sql','utf8');
const intake=await readFile('supabase/functions/public-intake/index.ts','utf8');
const legal=await readFile('../legal.html','utf8');
const publicScript=await readFile('../script.js','utf8');
const failures=[];

if(!migration.includes('private.public_intake_rate_limits'))failures.push('El contador no está aislado en el esquema privado.');
if(!bootstrap.includes('public.server_consume_public_intake_limit'))failures.push('Una instalación nueva no incorpora el límite público.');
if(!migration.includes("p_scope not in ('email', 'ip')"))failures.push('La función acepta ámbitos de límite no previstos.');
if(!migration.includes('on conflict (scope, fingerprint, window_started)'))failures.push('El consumo del límite no es atómico.');
if(!migration.includes('revoke all on function public.server_consume_public_intake_limit')||!migration.includes('to service_role'))failures.push('La función de límite queda expuesta a usuarios del navegador.');
if(!intake.includes("consumeLimit('email'")||!intake.includes("consumeLimit('ip'"))failures.push('El formulario no aplica ambos límites.');
if(!intake.includes("error:'TOO_MANY_REQUESTS'")||!intake.includes("'retry-after'"))failures.push('El formulario no devuelve una respuesta 429 utilizable.');
if(!intake.includes("crypto.subtle.sign('HMAC'"))failures.push('Las huellas no utilizan HMAC.');
if(intake.includes('clientIp,')||intake.includes('email,window'))failures.push('El límite parece persistir datos identificativos en claro.');
if(!legal.includes('huellas criptográficas temporales'))failures.push('La información legal no explica el control técnico contra abuso.');
if(!publicScript.includes("response.status === 429")||!publicScript.includes('Si ya recibiste una referencia'))failures.push('La web no explica correctamente un bloqueo temporal legítimo.');

console.log(JSON.stringify({passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;

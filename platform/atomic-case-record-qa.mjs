import {readFileSync} from 'node:fs';

const migration=readFileSync('supabase/migrations/20260814111957_atomic_case_record_update.sql','utf8');
const crm=readFileSync('supabase/functions/manage-crm/index.ts','utf8');

const checks={
  oneTransaction:/create or replace function public\.server_update_case_record/i.test(migration),
  rowLocked:/for update;/i.test(migration),
  caseUpdated:/update public\.cases/i.test(migration),
  chronologyWritten:/insert into public\.case_events/i.test(migration),
  auditWritten:/insert into public\.audit_events/i.test(migration),
  restrictedToServiceRole:/revoke all on function public\.server_update_case_record[\s\S]+from public,anon,authenticated;[\s\S]+grant execute[\s\S]+to service_role;/i.test(migration),
  crmUsesRpc:/serviceClient\.rpc\('server_update_case_record'/i.test(crm),
  oldSplitWritesRemoved:!crm.includes("serviceClient.from('cases').update({manual_phase")
};

const failures=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({passed:failures.length===0,checks,failures},null,2));
if(failures.length)process.exitCode=1;

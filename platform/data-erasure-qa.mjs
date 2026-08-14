import {readFileSync} from 'node:fs';

const migration=readFileSync('supabase/migrations/20260814112632_allow_case_erasure_audit_detach.sql','utf8');
const protocol=readFileSync('DATA_ERASURE_PROTOCOL.md','utf8');

const checks={
  nullDetachOnly:/old\.case_id is not null[\s\S]+new\.case_id is null/i.test(migration),
  otherColumnsImmutable:/to_jsonb\(new\)-'case_id'[\s\S]+to_jsonb\(old\)-'case_id'/i.test(migration),
  deletesStillBlocked:/raise exception 'audit_events is append-only'/i.test(migration),
  untrustedCannotExecute:/revoke execute[\s\S]+from public,anon,authenticated/i.test(migration),
  protocolDocumentsDetachment:/audit_events\.case_id[\s\S]+desliga/i.test(protocol)
};
const failures=Object.entries(checks).filter(([,passed])=>!passed).map(([name])=>name);
console.log(JSON.stringify({passed:failures.length===0,checks,failures},null,2));
if(failures.length)process.exitCode=1;

import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('./supabase/migrations/20260815202500_record_ai_and_document_timeline.sql',import.meta.url),'utf8');
const checks={
  aiRunTrigger:migration.includes('case_ai_runs_record_timeline')&&migration.includes("'ai_analysis_completed'"),
  documentVersionTrigger:migration.includes('case_document_versions_record_timeline')&&migration.includes("'working_document_version_created'"),
  internalOnly:(migration.match(/'internal'/g)||[]).length>=4,
  linkedMetadata:['ai_run_id','document_version_id','working_document_id','version_number'].every(field=>migration.includes(`'${field}'`)),
  recentRepair:migration.includes("now()-interval '24 hours'")&&migration.includes('not exists('),
  transactional:migration.includes('after insert on public.case_ai_runs')&&migration.includes('after insert on public.case_document_versions')
};
const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({passed:!failures.length,checks,failures},null,2));
if(failures.length)process.exit(1);

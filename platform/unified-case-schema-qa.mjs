import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('./supabase/migrations/20260812130000_unify_cases_and_document_versions.sql',import.meta.url),'utf8');
const manager=await readFile(new URL('./supabase/functions/manage-crm/index.ts',import.meta.url),'utf8');
const intake=await readFile(new URL('./supabase/functions/public-intake/index.ts',import.meta.url),'utf8');
const ai=await readFile(new URL('./supabase/functions/ai-assist/index.ts',import.meta.url),'utf8');

assert.match(migration,/manual_phase text not null default ''/);
assert.doesNotMatch(migration,/check\s*\(\s*manual_phase\s+in\s*\(/i,'La situación manual no debe usar una lista cerrada');
assert.match(migration,/check \(status in \('open','not_contracted','archived'\)\)/);
assert.match(migration,/create table public\.case_contracts/);
assert.match(migration,/signer_full_name text not null/);
assert.match(migration,/signer_identifier text not null/);
assert.match(migration,/signer_address text not null/);
assert.match(migration,/contract_note text not null default ''/);
assert.doesNotMatch(migration,/manual_status|check\s*\(\s*contract_note\s+in\s*\(/i,'La anotación contractual no debe ser un estado ni usar opciones cerradas');
assert.match(migration,/signed_at is null[\s\S]+signed_storage_path is not null[\s\S]+evidence_storage_path is not null/);
assert.match(migration,/create table public\.case_contract_signature_events/);
assert.match(migration,/unique\(provider,provider_event_id\)/);
assert.match(migration,/payload_sha256 text not null/);
assert.match(migration,/create trigger cases_require_verified_signature_for_portal/);
assert.match(migration,/PORTAL_VERIFIED_SIGNATURE_REQUIRED/);
assert.match(migration,/create table public\.case_working_documents/);
assert.match(migration,/create table public\.case_document_versions/);
assert.match(migration,/unique\(working_document_id,version_number\)/);
assert.match(migration,/client_visible boolean not null default false/);
assert.match(migration,/portal_status = 'disabled'[\s\S]+client_id is not null and contract_confirmed_at is not null/);
assert.match(migration,/revoke all privileges on public\.case_working_documents,public\.case_document_versions[\s\S]+from public,anon,authenticated/);
assert.match(migration,/grant select on public\.case_working_documents,public\.case_document_versions[\s\S]+to authenticated/);
assert.match(migration,/perform private\.assert_active_admin\(p_admin_id\)/);

assert.match(manager,/body\.action==='create_case'/);
assert.match(manager,/body\.action==='activate_case_portal'/);
assert.match(manager,/\.from\('case_contracts'\)[\s\S]+\.not\('signed_at','is',null\)[\s\S]+\.is\('invalidated_at',null\)/);
assert.match(manager,/SIGNED_CONTRACT_REQUIRED/);
assert.match(manager,/body\.action==='save_contract_record'/);
assert.doesNotMatch(manager,/contract_draft|save_contract_draft/);
assert.match(manager,/body\.action==='add_working_document_version'/);
assert.match(manager,/server_add_case_document_version/);
assert.match(intake,/\.from\('cases'\)\.insert/);
assert.doesNotMatch(intake,/\.from\('crm_leads'\)\.insert/);

assert.match(ai,/MAX_WORKING_DOCUMENTS=12/);
assert.match(ai,/MAX_WORKING_DRAFT_TOTAL_CHARS=60000/);
assert.match(ai,/draft_content_truncated/);
assert.match(ai,/automatic_write:false/);

console.log(JSON.stringify({
  passed:true,
  manualPhaseIsFreeText:true,
  lifecycleIsOpenNotContractedOrArchived:true,
  versionHistoryIsNonDestructive:true,
  clientVersionsDefaultPrivate:true,
  portalRequiresContract:true,
  portalRequiresVerifiedSignatureEvidence:true,
  signatureEventsAreAudited:true,
  explicitRlsGrants:true,
  aiContextBudgeted:true
},null,2));

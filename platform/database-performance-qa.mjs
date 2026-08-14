import { readFile } from 'node:fs/promises';

const migration = await readFile(
  'supabase/migrations/20260814230045_add_remaining_foreign_key_indexes.sql',
  'utf8'
);

const expectedIndexes = [
  'case_communication_requests_requested_by_idx',
  'case_communication_requests_responded_by_idx',
  'case_contracts_created_by_idx',
  'case_document_versions_created_by_idx',
  'case_working_documents_created_by_idx'
];

const failures = expectedIndexes
  .filter((indexName) => !migration.includes(`create index if not exists ${indexName}`))
  .map((indexName) => `Falta el indice ${indexName}.`);

console.log(JSON.stringify({ passed: failures.length === 0, failures }, null, 2));
if (failures.length) process.exitCode = 1;

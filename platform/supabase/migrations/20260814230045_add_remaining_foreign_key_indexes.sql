create index if not exists case_communication_requests_requested_by_idx
  on public.case_communication_requests(requested_by);

create index if not exists case_communication_requests_responded_by_idx
  on public.case_communication_requests(responded_by);

create index if not exists case_contracts_created_by_idx
  on public.case_contracts(created_by);

create index if not exists case_document_versions_created_by_idx
  on public.case_document_versions(created_by);

create index if not exists case_working_documents_created_by_idx
  on public.case_working_documents(created_by);

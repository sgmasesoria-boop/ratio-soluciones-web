-- Indices de apoyo para las relaciones de auditoria creadas recientemente.
create index if not exists case_ai_document_index_requested_by_idx
  on public.case_ai_document_index(requested_by)
  where requested_by is not null;

create index if not exists case_internal_documents_security_reviewed_by_idx
  on public.case_internal_documents(security_reviewed_by)
  where security_reviewed_by is not null;

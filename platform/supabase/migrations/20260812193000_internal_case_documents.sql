-- Documentos aportados o creados por Ratio para el trabajo interno del expediente.
-- Se separan del canal documental del cliente para impedir su exposicion accidental.

create table public.case_internal_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  storage_bucket text not null default 'case-internal-documents'
    check (storage_bucket = 'case-internal-documents'),
  storage_path text not null unique,
  title text not null check (char_length(btrim(title)) between 2 and 180),
  note text not null default '' check (char_length(note) <= 1000),
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 15728640),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index case_internal_documents_case_time_idx
  on public.case_internal_documents(case_id,created_at desc);
create index case_internal_documents_uploaded_by_idx
  on public.case_internal_documents(uploaded_by);

alter table public.case_internal_documents enable row level security;
create policy case_internal_documents_admin_read
  on public.case_internal_documents for select to authenticated
  using (private.can_manage_case(case_id));

revoke all privileges on public.case_internal_documents from public,anon,authenticated;
grant select on public.case_internal_documents to authenticated;
grant select,insert,delete on public.case_internal_documents to service_role;

-- Sin politicas sobre storage.objects: todo acceso binario pasa por la funcion
-- Edge, exige sesion administrativa AAL2 y genera un evento de auditoria.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'case-internal-documents',
  'case-internal-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

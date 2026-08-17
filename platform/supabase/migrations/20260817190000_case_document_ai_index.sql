-- Indice documental privado por expediente.
-- Cada archivo se procesa de forma independiente y su resultado minimizado se
-- reutiliza en los analisis posteriores sin reenviar todo el archivo.

create table public.case_ai_document_index (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  client_document_id uuid references public.case_documents(id) on delete cascade,
  internal_document_id uuid references public.case_internal_documents(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  document_sha256 text not null check (document_sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null,
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed')),
  extraction jsonb,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0
    check (estimated_cost_usd >= 0),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_ai_document_index_one_source check (
    (client_document_id is not null and internal_document_id is null)
    or (client_document_id is null and internal_document_id is not null)
  )
);

create unique index case_ai_document_index_client_document_idx
  on public.case_ai_document_index(client_document_id)
  where client_document_id is not null;

create unique index case_ai_document_index_internal_document_idx
  on public.case_ai_document_index(internal_document_id)
  where internal_document_id is not null;

create unique index case_ai_document_index_one_active_per_case_idx
  on public.case_ai_document_index(case_id)
  where status in ('queued','processing');

create index case_ai_document_index_case_status_idx
  on public.case_ai_document_index(case_id,status,updated_at desc);

alter table public.case_ai_document_index enable row level security;

-- Solo las funciones Edge, tras exigir administrador y AAL2, pueden acceder.
revoke all privileges on public.case_ai_document_index
  from public,anon,authenticated;
grant select,insert,update,delete on public.case_ai_document_index to service_role;


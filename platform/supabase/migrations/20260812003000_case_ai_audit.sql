-- Historial interno y auditable de analisis asistidos por IA por expediente.
-- No se expone al cliente ni a la Data API de usuarios autenticados.

create table public.case_ai_runs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('analyze_case')),
  model text not null,
  prompt_version text not null,
  status text not null default 'completed' check (status in ('completed','failed')),
  result jsonb not null,
  source_refs jsonb not null default '[]'::jsonb,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(12,6) not null default 0 check (estimated_cost_usd >= 0),
  automatic_write boolean not null default false check (automatic_write = false),
  created_at timestamptz not null default now()
);

create index case_ai_runs_case_time_idx
  on public.case_ai_runs(case_id,created_at desc);
create index case_ai_runs_requested_by_idx
  on public.case_ai_runs(requested_by) where requested_by is not null;

alter table public.case_ai_runs enable row level security;

-- La funcion Edge usa service_role despues de exigir administrador y AAL2.
-- Ningun navegador, ni siquiera autenticado, puede leer o escribir esta tabla.
revoke all privileges on public.case_ai_runs from public, anon, authenticated;

create trigger case_ai_runs_no_update
  before update or delete on public.case_ai_runs
  for each row execute function private.prevent_audit_changes();


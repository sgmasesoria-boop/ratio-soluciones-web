-- Cola privada para ejecutar analisis largos sin mantener abierta la peticion HTTP.
-- El resultado final permanece en case_ai_runs, que sigue siendo inmutable y auditable.

create table public.case_ai_jobs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  result_run_id uuid unique references public.case_ai_runs(id) on delete set null,
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index case_ai_jobs_one_active_per_case_idx
  on public.case_ai_jobs(case_id)
  where status in ('queued','processing');

create index case_ai_jobs_case_time_idx
  on public.case_ai_jobs(case_id,created_at desc);

create index case_ai_jobs_requested_by_idx
  on public.case_ai_jobs(requested_by)
  where requested_by is not null;

alter table public.case_ai_jobs enable row level security;

-- Solo la funcion Edge, tras exigir administrador y AAL2, gestiona la cola.
revoke all privileges on public.case_ai_jobs from public, anon, authenticated;

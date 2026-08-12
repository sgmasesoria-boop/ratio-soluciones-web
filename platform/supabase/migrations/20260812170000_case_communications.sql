-- Canal trazable para que el cliente solicite una aclaracion o una llamada.
-- No sustituye el deber de informacion ni impide el contacto directo con el
-- profesional cuando sea necesario por el encargo o por sus obligaciones.

create table public.case_communication_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  subject text not null check (char_length(btrim(subject)) between 3 and 140),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  deadline_context text not null default '' check (char_length(deadline_context) <= 1000),
  availability_note text not null default '' check (char_length(availability_note) <= 500),
  response_text text not null default '' check (char_length(response_text) <= 4000),
  responded_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (responded_at is null and responded_by is null and response_text='')
    or (responded_at is not null and responded_by is not null and char_length(btrim(response_text)) >= 2)
  )
);

create index case_communication_requests_case_time_idx
  on public.case_communication_requests(case_id,created_at desc);
create index case_communication_requests_pending_idx
  on public.case_communication_requests(created_at)
  where responded_at is null;

alter table public.case_communication_requests enable row level security;
create policy case_communication_requests_read
  on public.case_communication_requests for select to authenticated
  using (private.can_access_case(case_id));

revoke all privileges on public.case_communication_requests from public,anon,authenticated;
grant select on public.case_communication_requests to authenticated;
grant select,insert,update on public.case_communication_requests to service_role;


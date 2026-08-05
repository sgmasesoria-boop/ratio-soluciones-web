-- Ratio Soluciones · CRM interno para consultas, seguimiento y conversión a expediente.
create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  full_name text not null,
  phone text not null,
  email text not null,
  province text,
  category text not null,
  source text not null,
  summary text not null,
  status text not null default 'new' check (status in ('new','review','waiting','viable','proposal','contract','won','lost')),
  next_action text,
  follow_up_on date,
  quoted_amount numeric(12,2) not null default 0 check (quoted_amount >= 0),
  consent_at timestamptz not null,
  privacy_version text not null default 'web-v1',
  converted_case_id uuid references public.cases(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  body text not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  title text not null,
  due_on date not null,
  priority text not null default 'normal' check (priority in ('normal','high')),
  assigned_to uuid references public.profiles(id),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (lead_id is not null or case_id is not null)
);

create index crm_leads_status_follow_up_idx on public.crm_leads(status,follow_up_on);
create index crm_leads_email_idx on public.crm_leads(lower(email));
create index crm_notes_lead_time_idx on public.crm_lead_notes(lead_id,created_at desc);
create index crm_tasks_due_idx on public.crm_tasks(completed_at,due_on);
create trigger crm_leads_touch before update on public.crm_leads for each row execute function private.touch_updated_at();

alter table public.crm_leads enable row level security;
alter table public.crm_lead_notes enable row level security;
alter table public.crm_tasks enable row level security;

create policy crm_leads_admin_all on public.crm_leads for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy crm_notes_admin_all on public.crm_lead_notes for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy crm_tasks_admin_all on public.crm_tasks for all to authenticated using (private.is_admin()) with check (private.is_admin());

create or replace function public.server_convert_lead(
  p_lead_id uuid,p_client_id uuid,p_admin_id uuid,p_reference text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.crm_leads%rowtype; new_case_id uuid;
begin
  select * into strict target from public.crm_leads where id=p_lead_id for update;
  if target.status='won' or target.converted_case_id is not null then raise exception 'LEAD_ALREADY_CONVERTED'; end if;

  insert into public.profiles(id,display_name,internal_role,active)
  values(p_client_id,target.full_name,'client',true)
  on conflict(id) do update set display_name=excluded.display_name,active=true;

  insert into public.cases(reference,client_id,client_name,title,category,status,summary,created_by)
  values(p_reference,p_client_id,target.full_name,left(target.summary,160),target.category,'open',target.summary,p_admin_id)
  returning id into new_case_id;

  insert into public.case_members(case_id,user_id,membership_role,assigned_by)
  values(new_case_id,p_admin_id,'owner',p_admin_id);
  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id)
  values(new_case_id,'case_opened','Expediente abierto','La consulta ha sido aceptada y convertida en expediente.','client','open',p_admin_id);
  update public.crm_leads set status='won',converted_case_id=new_case_id,next_action=null,follow_up_on=null where id=p_lead_id;
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(new_case_id,p_admin_id,'lead_converted','crm_lead',p_lead_id::text,jsonb_build_object('reference',p_reference));
  return new_case_id;
end; $$;

revoke all on function public.server_convert_lead(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.server_convert_lead(uuid,uuid,uuid,text) to service_role;

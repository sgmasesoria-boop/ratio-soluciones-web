-- Ratio Soluciones - instalación inicial completa de Supabase
-- Ejecutar una sola vez en el SQL Editor del proyecto bvpeztdfwdbiielaione.

begin;

-- ===== 001_schema.sql =====
-- Ratio Soluciones · esquema simplificado de seguimiento, sin almacenamiento documental.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  internal_role text not null default 'client' check (internal_role in ('client','professional','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_id uuid not null references public.profiles(id),
  client_name text not null,
  title text not null,
  category text not null,
  status text not null default 'open' check (status in ('open','study','action','response','resolution','closed','archived')),
  summary text,
  client_next_step text,
  professional_name text,
  professional_title text,
  professional_registration text,
  professional_region text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_members (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null check (membership_role in ('owner','manager','professional','viewer')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  revoked_at timestamptz,
  primary key (case_id,user_id)
);

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  visibility text not null default 'client' check (visibility in ('client','internal')),
  stage text,
  actor_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  external_hint text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cases_client_idx on public.cases(client_id);
create index case_members_user_idx on public.case_members(user_id) where revoked_at is null;
create index case_events_case_time_idx on public.case_events(case_id,occurred_at);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index audit_case_time_idx on public.audit_events(case_id,created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger cases_touch before update on public.cases for each row execute function private.touch_updated_at();

create or replace function private.prevent_audit_changes()
returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end; $$;
create trigger audit_no_update before update or delete on public.audit_events for each row execute function private.prevent_audit_changes();



-- ===== 002_rls.sql =====
-- Seguridad por expediente para el portal simplificado.
create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=uid and p.internal_role='admin' and p.active);
$$;

create or replace function private.can_access_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(select 1 from public.cases c where c.id=target_case and c.client_id=uid)
    or exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null);
$$;

create or replace function private.can_manage_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null and m.membership_role in ('owner','manager','professional'));
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.can_access_case(uuid,uuid) to authenticated;
grant execute on function private.can_manage_case(uuid,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.case_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id=auth.uid() or private.is_admin());
create policy profiles_admin_all on public.profiles for all to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy cases_read_members on public.cases for select to authenticated
using (private.can_access_case(id));
create policy cases_manage_authorized on public.cases for all to authenticated
using (private.can_manage_case(id)) with check (private.is_admin() or private.can_manage_case(id));

create policy members_read_case on public.case_members for select to authenticated
using (private.can_access_case(case_id));
create policy members_admin_write on public.case_members for all to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy events_read_by_visibility on public.case_events for select to authenticated
using (private.can_access_case(case_id) and (visibility='client' or private.can_manage_case(case_id)));
create policy events_manage_authorized on public.case_events for insert to authenticated
with check (private.can_manage_case(case_id) and actor_id=auth.uid());

create policy notifications_read_self on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_update_self on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy notifications_admin_insert on public.notifications for insert to authenticated with check (private.is_admin());
create policy audit_admin_read on public.audit_events for select to authenticated using (private.is_admin());

revoke insert,update,delete on public.audit_events from authenticated;



-- ===== 003_server_operations.sql =====
-- Operaciones atómicas reservadas a funciones Edge con service_role.
create or replace function public.server_create_invited_case(
  p_client_id uuid,p_display_name text,p_admin_id uuid,p_reference text,p_title text,p_category text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_case_id uuid;
begin
  insert into public.profiles(id,display_name,internal_role,active)
  values(p_client_id,p_display_name,'client',true)
  on conflict(id) do update set display_name=excluded.display_name,active=true;

  insert into public.cases(reference,client_id,client_name,title,category,status,created_by)
  values(p_reference,p_client_id,p_display_name,p_title,p_category,'open',p_admin_id)
  returning id into new_case_id;

  insert into public.case_members(case_id,user_id,membership_role,assigned_by)
  values(new_case_id,p_admin_id,'owner',p_admin_id);
  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id)
  values(new_case_id,'case_opened','Expediente abierto','Se ha creado el expediente y enviado el acceso privado.','client','open',p_admin_id);
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(new_case_id,p_admin_id,'client_invited','case',new_case_id::text,jsonb_build_object('reference',p_reference));
  return new_case_id;
end; $$;

create or replace function public.server_update_case(
  p_case_id uuid,p_admin_id uuid,p_status text,p_title text,p_description text,p_client_next_step text,
  p_professional_name text,p_professional_title text,p_professional_registration text,p_professional_region text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target_client uuid; new_event_id uuid;
begin
  if p_status not in ('open','study','action','response','resolution','closed') then raise exception 'INVALID_STATUS'; end if;
  select client_id into strict target_client from public.cases where id=p_case_id;
  update public.cases set status=p_status,client_next_step=nullif(p_client_next_step,''),
    professional_name=nullif(p_professional_name,''),professional_title=nullif(p_professional_title,''),
    professional_registration=nullif(p_professional_registration,''),professional_region=nullif(p_professional_region,''),
    closed_at=case when p_status='closed' then coalesce(closed_at,now()) else null end
  where id=p_case_id;
  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id)
  values(p_case_id,'case_update',p_title,p_description,'client',p_status,p_admin_id) returning id into new_event_id;
  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(target_client,p_case_id,'case_update','Nuevo avance en tu expediente',p_title,'Tienes una novedad en tu expediente. Accede al espacio privado para consultarla.');
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(p_case_id,p_admin_id,'case_updated','case_event',new_event_id::text,jsonb_build_object('status',p_status));
  return new_event_id;
end; $$;

revoke all on function public.server_create_invited_case(uuid,text,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.server_update_case(uuid,uuid,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.server_create_invited_case(uuid,text,uuid,text,text,text) to service_role;
grant execute on function public.server_update_case(uuid,uuid,text,text,text,text,text,text,text,text) to service_role;



-- ===== 004_crm.sql =====
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



-- ===== 005_security_and_minimization.sql =====
-- Endurecimiento previo a producción y minimización de datos del CRM.

-- Las escrituras funcionales se realizan exclusivamente mediante funciones Edge
-- autenticadas. Los usuarios del navegador conservan solo lectura por RLS, salvo
-- la marca de lectura de sus propias notificaciones.
drop policy if exists profiles_admin_all on public.profiles;
drop policy if exists cases_manage_authorized on public.cases;
drop policy if exists members_admin_write on public.case_members;
drop policy if exists events_manage_authorized on public.case_events;
drop policy if exists notifications_admin_insert on public.notifications;
drop policy if exists crm_leads_admin_all on public.crm_leads;
drop policy if exists crm_notes_admin_all on public.crm_lead_notes;
drop policy if exists crm_tasks_admin_all on public.crm_tasks;

drop policy if exists members_read_case on public.case_members;
create policy members_read_internal on public.case_members for select to authenticated
using (private.can_manage_case(case_id));

create policy crm_leads_admin_read on public.crm_leads for select to authenticated
using (private.is_admin());
create policy crm_notes_admin_read on public.crm_lead_notes for select to authenticated
using (private.is_admin());
create policy crm_tasks_admin_read on public.crm_tasks for select to authenticated
using (private.is_admin());

revoke insert,update,delete on public.profiles from authenticated;
revoke insert,update,delete on public.cases from authenticated;
revoke insert,update,delete on public.case_members from authenticated;
revoke insert,update,delete on public.case_events from authenticated;
revoke insert,update,delete on public.crm_leads from authenticated;
revoke insert,update,delete on public.crm_lead_notes from authenticated;
revoke insert,update,delete on public.crm_tasks from authenticated;
revoke insert,update,delete on public.notifications from authenticated;
grant update(read_at) on public.notifications to authenticated;

-- Un contacto inicial necesita un solo canal. El correo se completará antes de
-- crear el portal si la persona eligió inicialmente el teléfono.
alter table public.crm_leads alter column phone drop not null;
alter table public.crm_leads alter column email drop not null;
alter table public.crm_leads rename column consent_at to privacy_notice_at;
alter table public.crm_leads add column legal_basis text not null default 'precontractual_request'
  check (legal_basis in ('precontractual_request','contract','consent'));
alter table public.crm_leads alter column privacy_version set default 'web-v2';
alter table public.crm_leads add constraint crm_leads_contact_required
  check (nullif(btrim(phone),'') is not null or nullif(btrim(email),'') is not null);
alter table public.crm_leads add constraint crm_leads_phone_length
  check (phone is null or char_length(phone) between 7 and 30);
alter table public.crm_leads add constraint crm_leads_email_length
  check (email is null or char_length(email) between 5 and 254);

-- Evita que ni siquiera service_role cree o convierta expedientes indicando como
-- actor a una cuenta que no sea un administrador activo.
create or replace function private.assert_active_admin(target_admin uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.profiles where id=target_admin and internal_role='admin' and active) then
    raise exception 'INVALID_ADMIN';
  end if;
end; $$;
revoke all on function private.assert_active_admin(uuid) from public,anon,authenticated;
grant execute on function private.assert_active_admin(uuid) to service_role;

create or replace function public.server_create_invited_case(
  p_client_id uuid,p_display_name text,p_admin_id uuid,p_reference text,p_title text,p_category text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare new_case_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  insert into public.profiles(id,display_name,internal_role,active)
  values(p_client_id,p_display_name,'client',true)
  on conflict(id) do update set display_name=excluded.display_name,active=true;
  insert into public.cases(reference,client_id,client_name,title,category,status,created_by)
  values(p_reference,p_client_id,p_display_name,p_title,p_category,'open',p_admin_id)
  returning id into new_case_id;
  insert into public.case_members(case_id,user_id,membership_role,assigned_by)
  values(new_case_id,p_admin_id,'owner',p_admin_id);
  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id)
  values(new_case_id,'case_opened','Expediente abierto','Se ha creado el expediente y enviado el acceso privado.','client','open',p_admin_id);
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(new_case_id,p_admin_id,'client_invited','case',new_case_id::text,jsonb_build_object('reference',p_reference));
  return new_case_id;
end; $$;

create or replace function public.server_update_case(
  p_case_id uuid,p_admin_id uuid,p_status text,p_title text,p_description text,p_client_next_step text,
  p_professional_name text,p_professional_title text,p_professional_registration text,p_professional_region text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target_client uuid; new_event_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  if p_status not in ('open','study','action','response','resolution','closed') then raise exception 'INVALID_STATUS'; end if;
  select client_id into strict target_client from public.cases where id=p_case_id;
  update public.cases set status=p_status,client_next_step=nullif(p_client_next_step,''),
    professional_name=nullif(p_professional_name,''),professional_title=nullif(p_professional_title,''),
    professional_registration=nullif(p_professional_registration,''),professional_region=nullif(p_professional_region,''),
    closed_at=case when p_status='closed' then coalesce(closed_at,now()) else null end
  where id=p_case_id;
  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id)
  values(p_case_id,'case_update',p_title,p_description,'client',p_status,p_admin_id) returning id into new_event_id;
  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(target_client,p_case_id,'case_update','Nuevo avance en tu expediente',p_title,'Tienes una novedad en tu expediente. Accede al espacio privado para consultarla.');
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(p_case_id,p_admin_id,'case_updated','case_event',new_event_id::text,jsonb_build_object('status',p_status));
  return new_event_id;
end; $$;

create or replace function public.server_convert_lead(
  p_lead_id uuid,p_client_id uuid,p_admin_id uuid,p_reference text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.crm_leads%rowtype; new_case_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  select * into strict target from public.crm_leads where id=p_lead_id for update;
  if target.status='won' or target.converted_case_id is not null then raise exception 'LEAD_ALREADY_CONVERTED'; end if;
  if nullif(btrim(target.email),'') is null then raise exception 'EMAIL_REQUIRED_FOR_PORTAL'; end if;
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



-- ===== 006_require_email_and_phone.sql =====
-- La operativa aprobada exige ambos datos para confirmar, contactar y mantener
-- el seguimiento escrito de cada consulta.
do $$
begin
  if exists (
    select 1 from public.crm_leads
    where nullif(btrim(phone),'') is null or nullif(btrim(email),'') is null
  ) then
    raise exception 'CRM_CONTACT_DATA_MUST_BE_COMPLETED';
  end if;
end; $$;

alter table public.crm_leads drop constraint if exists crm_leads_contact_required;
alter table public.crm_leads alter column phone set not null;
alter table public.crm_leads alter column email set not null;
alter table public.crm_leads alter column privacy_version set default 'web-v3';

commit;
-- End of bootstrap.

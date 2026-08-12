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

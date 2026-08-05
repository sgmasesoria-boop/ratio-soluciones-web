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

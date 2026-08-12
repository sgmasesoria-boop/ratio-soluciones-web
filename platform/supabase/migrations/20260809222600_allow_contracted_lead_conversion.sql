create or replace function public.server_convert_lead(
  p_lead_id uuid,p_client_id uuid,p_admin_id uuid,p_reference text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.crm_leads%rowtype; new_case_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  select * into strict target from public.crm_leads where id=p_lead_id for update;
  if target.converted_case_id is not null then raise exception 'LEAD_ALREADY_CONVERTED'; end if;
  if target.status<>'won' then raise exception 'LEAD_NOT_CONTRACTED'; end if;
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
  insert into public.crm_lead_notes(lead_id,body,author_id)
  values(p_lead_id,'Consulta convertida en el expediente '||p_reference||'.',p_admin_id);
  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(new_case_id,p_admin_id,'lead_converted','crm_lead',p_lead_id::text,jsonb_build_object('reference',p_reference));
  return new_case_id;
end; $$;

revoke all on function public.server_convert_lead(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.server_convert_lead(uuid,uuid,uuid,text) to service_role;

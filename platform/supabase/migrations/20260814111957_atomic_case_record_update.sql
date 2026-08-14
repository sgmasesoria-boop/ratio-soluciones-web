create or replace function public.server_update_case_record(
  p_case_id uuid,
  p_admin_id uuid,
  p_phone text,
  p_email text,
  p_manual_phase text,
  p_lifecycle text,
  p_amount numeric,
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  previous public.cases%rowtype;
  created_event_ids uuid[] := array[]::uuid[];
  new_event_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);

  if p_lifecycle not in ('open','not_contracted','archived') then
    raise exception 'INVALID_LIFECYCLE';
  end if;
  if nullif(btrim(p_phone),'') is null or nullif(btrim(p_email),'') is null or p_amount < 0 then
    raise exception 'INVALID_FIELDS';
  end if;

  select * into strict previous
  from public.cases
  where id=p_case_id
  for update;

  update public.cases
  set manual_phase=nullif(btrim(p_manual_phase),''),
      status=p_lifecycle,
      contact_phone=btrim(p_phone),
      contact_email=lower(btrim(p_email)),
      quoted_amount=p_amount,
      closed_at=case
        when p_lifecycle='open' then null
        else coalesce(previous.closed_at,now())
      end
  where id=p_case_id;

  if coalesce(previous.manual_phase,'')<>coalesce(btrim(p_manual_phase),'') then
    insert into public.case_events(case_id,event_type,title,description,visibility,actor_id,metadata)
    values(
      p_case_id,'internal_phase_changed',
      coalesce(nullif(btrim(p_manual_phase),''),'Situación interna sin indicación'),
      '','internal',p_admin_id,
      jsonb_build_object('previous_label',coalesce(previous.manual_phase,''))
    ) returning id into new_event_id;
    created_event_ids:=array_append(created_event_ids,new_event_id);
  end if;

  if previous.status<>p_lifecycle then
    insert into public.case_events(case_id,event_type,title,description,visibility,actor_id,metadata)
    values(
      p_case_id,'case_lifecycle_changed',
      case p_lifecycle
        when 'open' then 'Expediente abierto'
        when 'not_contracted' then 'Expediente cerrado sin contratación'
        else 'Expediente archivado tras su terminación'
      end,
      '','internal',p_admin_id,
      jsonb_build_object('previous_lifecycle',previous.status)
    ) returning id into new_event_id;
    created_event_ids:=array_append(created_event_ids,new_event_id);
  end if;

  if nullif(btrim(p_note),'') is not null then
    insert into public.case_events(case_id,event_type,title,description,visibility,actor_id)
    values(p_case_id,'internal_note','Nota interna',btrim(p_note),'internal',p_admin_id)
    returning id into new_event_id;
    created_event_ids:=array_append(created_event_ids,new_event_id);
  end if;

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    p_case_id,p_admin_id,'case_record_updated','case',p_case_id::text,
    jsonb_build_object(
      'manual_phase',coalesce(nullif(btrim(p_manual_phase),''),''),
      'lifecycle',p_lifecycle,
      'phase_changed',coalesce(previous.manual_phase,'')<>coalesce(btrim(p_manual_phase),''),
      'lifecycle_changed',previous.status<>p_lifecycle,
      'event_ids',to_jsonb(created_event_ids)
    )
  );

  return jsonb_build_object('ok',true,'event_ids',to_jsonb(created_event_ids));
exception
  when no_data_found then
    raise exception 'CASE_NOT_FOUND';
end;
$$;

revoke all on function public.server_update_case_record(uuid,uuid,text,text,text,text,numeric,text)
from public,anon,authenticated;
grant execute on function public.server_update_case_record(uuid,uuid,text,text,text,text,numeric,text)
to service_role;

comment on function public.server_update_case_record(uuid,uuid,text,text,text,text,numeric,text)
is 'Actualiza la ficha interna, su cronología y la auditoría en una única transacción.';

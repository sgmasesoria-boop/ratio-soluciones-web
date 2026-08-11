-- Unifica las peticiones al cliente: entrega documental o aclaración escrita.
-- La cronología conserva los hechos; la tarjeta "Qué necesitamos de ti" se
-- alimenta únicamente de peticiones pendientes.

alter table public.document_requests
  add column request_type text not null default 'document',
  add column response_text text,
  add column response_at timestamptz;

alter table public.document_requests
  add constraint document_requests_type_check
    check (request_type in ('document','clarification')),
  add constraint document_requests_response_length_check
    check (response_text is null or char_length(response_text) between 1 and 4000);

create index document_requests_client_action_idx
  on public.document_requests(case_id,status,request_type,requested_at desc);

create or replace function public.server_create_client_request(
  p_case_id uuid,
  p_admin_id uuid,
  p_request_type text,
  p_title text,
  p_instructions text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_client uuid;
  new_request_id uuid;
  event_type text;
  event_prefix text;
  notification_title text;
begin
  perform private.assert_active_admin(p_admin_id);
  if p_request_type not in ('document','clarification')
    or char_length(btrim(p_title)) not between 3 and 120
    or char_length(coalesce(p_instructions,'')) > 800 then
    raise exception 'INVALID_CLIENT_REQUEST';
  end if;

  select client_id into strict target_client
  from public.cases
  where id=p_case_id and status not in ('closed','archived');

  insert into public.document_requests(
    case_id,request_type,title,instructions,requested_by
  ) values(
    p_case_id,p_request_type,btrim(p_title),btrim(coalesce(p_instructions,'')),p_admin_id
  ) returning id into new_request_id;

  event_type := case when p_request_type='document' then 'document_requested' else 'clarification_requested' end;
  event_prefix := case when p_request_type='document' then 'Documentación solicitada: ' else 'Aclaración solicitada: ' end;
  notification_title := case when p_request_type='document' then 'Nueva solicitud de documentación' else 'Necesitamos una aclaración' end;

  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id,metadata)
  values(
    p_case_id,event_type,event_prefix || btrim(p_title),
    nullif(btrim(coalesce(p_instructions,'')),''),'client',null,p_admin_id,
    jsonb_build_object('client_request_id',new_request_id,'request_type',p_request_type)
  );

  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(
    target_client,p_case_id,event_type,notification_title,btrim(p_title),
    'Accede a la plataforma privada para consultar y responder la solicitud.'
  );

  if p_request_type='document' then
    insert into public.document_access_events(case_id,request_id,actor_id,action)
    values(p_case_id,new_request_id,p_admin_id,'requested');
  end if;

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    p_case_id,p_admin_id,event_type,'client_request',new_request_id::text,
    jsonb_build_object('title',btrim(p_title),'request_type',p_request_type)
  );

  return new_request_id;
end;
$$;

create or replace function public.server_submit_clarification(
  p_case_id uuid,
  p_request_id uuid,
  p_client_id uuid,
  p_response_text text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_request public.document_requests%rowtype;
begin
  if char_length(btrim(coalesce(p_response_text,''))) not between 2 and 4000 then
    raise exception 'INVALID_CLARIFICATION_RESPONSE';
  end if;

  if not exists(
    select 1 from public.profiles p where p.id=p_client_id and p.active
  ) or not exists(
    select 1
    from public.cases c
    left join public.case_members m
      on m.case_id=c.id and m.user_id=p_client_id and m.revoked_at is null
    where c.id=p_case_id and (c.client_id=p_client_id or m.user_id is not null)
  ) then
    raise exception 'CLIENT_REQUEST_ACCESS_DENIED';
  end if;

  select * into strict target_request
  from public.document_requests
  where id=p_request_id and case_id=p_case_id
    and request_type='clarification' and status='pending'
  for update;

  update public.document_requests
  set status='submitted',response_text=btrim(p_response_text),
      response_at=now(),fulfilled_at=now()
  where id=p_request_id;

  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id,metadata)
  values(
    p_case_id,'clarification_submitted','Aclaración enviada: ' || target_request.title,
    btrim(p_response_text),'client',null,p_client_id,
    jsonb_build_object('client_request_id',p_request_id,'request_type','clarification')
  );

  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(
    target_request.requested_by,p_case_id,'clarification_submitted',
    'Aclaración recibida',target_request.title,
    'La respuesta está disponible dentro del expediente.'
  );

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    p_case_id,p_client_id,'clarification_submitted','client_request',p_request_id::text,
    jsonb_build_object('request_type','clarification')
  );
end;
$$;

create or replace function public.server_cancel_client_request(
  p_request_id uuid,
  p_admin_id uuid
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_request public.document_requests%rowtype;
  target_client uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  select * into strict target_request
  from public.document_requests
  where id=p_request_id and status='pending'
  for update;

  select client_id into strict target_client from public.cases where id=target_request.case_id;
  update public.document_requests set status='cancelled',cancelled_at=now() where id=p_request_id;

  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id,metadata)
  values(
    target_request.case_id,'client_request_cancelled','Solicitud retirada: ' || target_request.title,
    'Ya no necesitamos esta respuesta.','client',null,p_admin_id,
    jsonb_build_object('client_request_id',p_request_id,'request_type',target_request.request_type)
  );

  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(
    target_client,target_request.case_id,'client_request_cancelled',
    'Solicitud retirada',target_request.title,
    'Ya no tienes que responder esta solicitud.'
  );

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    target_request.case_id,p_admin_id,'client_request_cancelled','client_request',p_request_id::text,
    jsonb_build_object('request_type',target_request.request_type)
  );
end;
$$;

revoke all on function public.server_create_client_request(uuid,uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.server_submit_clarification(uuid,uuid,uuid,text)
  from public,anon,authenticated;
revoke all on function public.server_cancel_client_request(uuid,uuid)
  from public,anon,authenticated;

grant execute on function public.server_create_client_request(uuid,uuid,text,text,text)
  to service_role;
grant execute on function public.server_submit_clarification(uuid,uuid,uuid,text)
  to service_role;
grant execute on function public.server_cancel_client_request(uuid,uuid)
  to service_role;

-- Flujo documental privado por expediente.
-- Los binarios se guardan en Storage; Postgres conserva solicitudes, metadatos
-- y trazabilidad. Ninguna escritura se permite directamente desde el navegador.

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  instructions text not null default '' check (char_length(instructions) <= 800),
  status text not null default 'pending'
    check (status in ('pending','submitted','accepted','cancelled')),
  client_visible boolean not null default true,
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz
);

create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  request_id uuid not null references public.document_requests(id) on delete restrict,
  storage_bucket text not null default 'case-documents'
    check (storage_bucket = 'case-documents'),
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null
    check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded'
    check (status in ('uploaded','accepted','rejected','deleted')),
  visibility text not null default 'client'
    check (visibility in ('client','internal')),
  uploaded_by uuid not null references public.profiles(id),
  privacy_notice_version text not null,
  privacy_notice_at timestamptz not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  deleted_at timestamptz
);

create table public.document_access_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases(id) on delete set null,
  request_id uuid references public.document_requests(id) on delete set null,
  document_id uuid references public.case_documents(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null
    check (action in ('requested','uploaded','download_link_created','accepted','rejected','deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index document_requests_case_time_idx
  on public.document_requests(case_id,requested_at desc);
create index document_requests_pending_idx
  on public.document_requests(case_id,status) where status in ('pending','submitted');
create index document_requests_requested_by_idx
  on public.document_requests(requested_by);
create index case_documents_case_time_idx
  on public.case_documents(case_id,created_at desc) where deleted_at is null;
create index case_documents_request_idx
  on public.case_documents(request_id,created_at desc) where deleted_at is null;
create index case_documents_uploaded_by_idx
  on public.case_documents(uploaded_by);
create index case_documents_reviewed_by_idx
  on public.case_documents(reviewed_by) where reviewed_by is not null;
create index document_access_case_time_idx
  on public.document_access_events(case_id,created_at desc);
create index document_access_request_idx
  on public.document_access_events(request_id) where request_id is not null;
create index document_access_document_idx
  on public.document_access_events(document_id) where document_id is not null;
create index document_access_actor_idx
  on public.document_access_events(actor_id) where actor_id is not null;

create trigger document_access_no_update
  before update or delete on public.document_access_events
  for each row execute function private.prevent_audit_changes();

alter table public.document_requests enable row level security;
alter table public.case_documents enable row level security;
alter table public.document_access_events enable row level security;

create policy document_requests_read_case on public.document_requests
  for select to authenticated
  using (
    private.can_access_case(case_id)
    and (client_visible or private.can_manage_case(case_id))
  );

create policy case_documents_read_case on public.case_documents
  for select to authenticated
  using (
    deleted_at is null
    and private.can_access_case(case_id)
    and (visibility = 'client' or private.can_manage_case(case_id))
  );

create policy document_access_internal_read on public.document_access_events
  for select to authenticated
  using (private.can_manage_case(case_id));

revoke all privileges on
  public.document_requests,
  public.case_documents,
  public.document_access_events
from anon, authenticated;

grant select on
  public.document_requests,
  public.case_documents,
  public.document_access_events
to authenticated;

-- Bucket privado, con tipos y tamaño ajustados al piloto. No se crean políticas
-- sobre storage.objects: todo acceso pasa por la función Edge y queda auditado.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'case-documents',
  'case-documents',
  false,
  5242880,
  array['application/pdf','image/jpeg','image/png']::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.server_create_document_request(
  p_case_id uuid,
  p_admin_id uuid,
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
begin
  perform private.assert_active_admin(p_admin_id);
  if char_length(btrim(p_title)) not between 3 and 120
    or char_length(coalesce(p_instructions,'')) > 800 then
    raise exception 'INVALID_DOCUMENT_REQUEST';
  end if;

  select client_id into strict target_client
  from public.cases
  where id=p_case_id and status not in ('closed','archived');

  insert into public.document_requests(case_id,title,instructions,requested_by)
  values(p_case_id,btrim(p_title),btrim(coalesce(p_instructions,'')),p_admin_id)
  returning id into new_request_id;

  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id,metadata)
  values(
    p_case_id,
    'document_requested',
    'Documentación solicitada: ' || btrim(p_title),
    nullif(btrim(coalesce(p_instructions,'')),''),
    'client',
    null,
    p_admin_id,
    jsonb_build_object('document_request_id',new_request_id)
  );

  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(
    target_client,
    p_case_id,
    'document_request',
    'Nueva solicitud de documentación',
    btrim(p_title),
    'Accede a la plataforma privada para consultar la solicitud y entregar el archivo.'
  );

  insert into public.document_access_events(case_id,request_id,actor_id,action)
  values(p_case_id,new_request_id,p_admin_id,'requested');

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    p_case_id,
    p_admin_id,
    'document_requested',
    'document_request',
    new_request_id::text,
    jsonb_build_object('title',btrim(p_title))
  );

  return new_request_id;
end;
$$;

create or replace function public.server_register_document_upload(
  p_case_id uuid,
  p_request_id uuid,
  p_uploader_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_privacy_notice_version text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_request public.document_requests%rowtype;
  new_document_id uuid;
begin
  if not exists(
    select 1
    from public.profiles p
    where p.id=p_uploader_id and p.active
  ) or not exists(
    select 1
    from public.cases c
    left join public.case_members m
      on m.case_id=c.id and m.user_id=p_uploader_id and m.revoked_at is null
    where c.id=p_case_id and (c.client_id=p_uploader_id or m.user_id is not null)
  ) then
    raise exception 'DOCUMENT_ACCESS_DENIED';
  end if;

  select * into strict target_request
  from public.document_requests
  where id=p_request_id and case_id=p_case_id and status in ('pending','submitted')
  for update;

  insert into public.case_documents(
    case_id,request_id,storage_path,original_name,mime_type,size_bytes,
    uploaded_by,privacy_notice_version,privacy_notice_at
  ) values(
    p_case_id,p_request_id,p_storage_path,p_original_name,p_mime_type,p_size_bytes,
    p_uploader_id,p_privacy_notice_version,now()
  ) returning id into new_document_id;

  update public.document_requests
  set status='submitted',fulfilled_at=coalesce(fulfilled_at,now())
  where id=p_request_id;

  insert into public.case_events(case_id,event_type,title,description,visibility,stage,actor_id,metadata)
  values(
    p_case_id,
    'document_uploaded',
    'Documentación entregada: ' || target_request.title,
    null,
    'client',
    null,
    p_uploader_id,
    jsonb_build_object('document_request_id',p_request_id,'document_id',new_document_id)
  );

  insert into public.notifications(user_id,case_id,notification_type,title,body,external_hint)
  values(
    target_request.requested_by,
    p_case_id,
    'document_uploaded',
    'Documentación recibida',
    target_request.title,
    'Se ha entregado un archivo en la plataforma privada.'
  );

  insert into public.document_access_events(case_id,request_id,document_id,actor_id,action,details)
  values(
    p_case_id,p_request_id,new_document_id,p_uploader_id,'uploaded',
    jsonb_build_object('mime_type',p_mime_type,'size_bytes',p_size_bytes)
  );

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    p_case_id,p_uploader_id,'document_uploaded','case_document',new_document_id::text,
    jsonb_build_object('request_id',p_request_id,'mime_type',p_mime_type,'size_bytes',p_size_bytes)
  );

  return new_document_id;
end;
$$;

create or replace function public.server_review_document(
  p_document_id uuid,
  p_admin_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target public.case_documents%rowtype;
begin
  perform private.assert_active_admin(p_admin_id);
  if p_status not in ('accepted','rejected') then
    raise exception 'INVALID_DOCUMENT_STATUS';
  end if;

  select * into strict target
  from public.case_documents
  where id=p_document_id and deleted_at is null
  for update;

  update public.case_documents
  set status=p_status,reviewed_at=now(),reviewed_by=p_admin_id
  where id=p_document_id;

  if p_status='accepted' then
    update public.document_requests set status='accepted'
    where id=target.request_id;
  end if;

  insert into public.document_access_events(case_id,request_id,document_id,actor_id,action)
  values(target.case_id,target.request_id,target.id,p_admin_id,p_status);

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(target.case_id,p_admin_id,'document_' || p_status,'case_document',target.id::text,'{}'::jsonb);
end;
$$;

revoke all on function public.server_create_document_request(uuid,uuid,text,text)
  from public,anon,authenticated;
revoke all on function public.server_register_document_upload(uuid,uuid,uuid,text,text,text,bigint,text)
  from public,anon,authenticated;
revoke all on function public.server_review_document(uuid,uuid,text)
  from public,anon,authenticated;

grant execute on function public.server_create_document_request(uuid,uuid,text,text)
  to service_role;
grant execute on function public.server_register_document_upload(uuid,uuid,uuid,text,text,text,bigint,text)
  to service_role;
grant execute on function public.server_review_document(uuid,uuid,text)
  to service_role;

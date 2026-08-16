-- Los documentos internos pueden proceder de papel, correo u otros canales.
-- Permanecen fuera del analisis de IA hasta una comprobacion humana expresa.

alter table public.case_internal_documents
  add column security_status text not null default 'pending_review'
    check (security_status in ('pending_review','accepted','rejected')),
  add column security_reviewed_at timestamptz,
  add column security_reviewed_by uuid references public.profiles(id),
  add column security_review_note text not null default ''
    check (char_length(security_review_note) <= 500);

create index case_internal_documents_security_status_idx
  on public.case_internal_documents(security_status,created_at desc);

create or replace function public.server_review_internal_document_security(
  p_document_id uuid,
  p_admin_id uuid,
  p_status text,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target public.case_internal_documents%rowtype;
begin
  perform private.assert_active_admin(p_admin_id);
  if p_status not in ('accepted','rejected')
    or char_length(coalesce(p_note,'')) > 500 then
    raise exception 'INVALID_INTERNAL_DOCUMENT_SECURITY_STATUS';
  end if;

  select * into strict target
  from public.case_internal_documents
  where id=p_document_id
  for update;

  if target.security_status <> 'pending_review' then
    raise exception 'INTERNAL_DOCUMENT_ALREADY_REVIEWED';
  end if;

  update public.case_internal_documents
  set security_status=p_status,
      security_reviewed_at=now(),
      security_reviewed_by=p_admin_id,
      security_review_note=btrim(coalesce(p_note,''))
  where id=p_document_id;

  insert into public.audit_events(
    case_id,actor_id,action,object_type,object_id,details
  ) values(
    target.case_id,p_admin_id,
    'internal_document_security_' || p_status,
    'case_internal_document',target.id::text,
    jsonb_build_object('sha256',target.sha256)
  );
end;
$$;

revoke all on function public.server_review_internal_document_security(
  uuid,uuid,text,text
) from public,anon,authenticated;
grant execute on function public.server_review_internal_document_security(
  uuid,uuid,text,text
) to service_role;

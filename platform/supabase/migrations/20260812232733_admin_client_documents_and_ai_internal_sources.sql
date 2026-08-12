-- Distingue los documentos aportados por el cliente de los documentos internos.
-- Ratio puede incorporar documentos entregados en mano sin atribuir falsamente
-- la subida al cliente. Los archivos siguen siendo privados y auditados.

alter table public.case_documents
  alter column request_id drop not null;

alter table public.case_documents
  add column intake_channel text not null default 'client_portal'
    check (intake_channel in ('client_portal','received_by_ratio'));

alter table public.case_documents
  drop constraint case_documents_mime_type_check;

alter table public.case_documents
  add constraint case_documents_mime_type_check
  check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ));

update storage.buckets
set allowed_mime_types=array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png'
]::text[]
where id='case-documents';

create or replace function public.server_register_admin_client_document(
  p_case_id uuid,
  p_admin_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text,
  p_privacy_notice_version text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_case public.cases%rowtype;
  new_document_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);

  if char_length(btrim(coalesce(p_original_name,''))) not between 1 and 180
    or p_mime_type not in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    )
    or p_size_bytes not between 1 and 5242880
    or p_sha256 !~ '^[0-9a-f]{64}$'
    or char_length(btrim(coalesce(p_privacy_notice_version,''))) < 3 then
    raise exception 'INVALID_ADMIN_CLIENT_DOCUMENT';
  end if;

  select * into strict target_case
  from public.cases
  where id=p_case_id and status='open';

  insert into public.case_documents(
    case_id,request_id,storage_path,original_name,mime_type,size_bytes,sha256,
    status,visibility,uploaded_by,privacy_notice_version,privacy_notice_at,
    reviewed_at,reviewed_by,intake_channel
  ) values(
    p_case_id,null,p_storage_path,btrim(p_original_name),p_mime_type,p_size_bytes,p_sha256,
    'accepted','client',p_admin_id,btrim(p_privacy_notice_version),now(),
    now(),p_admin_id,'received_by_ratio'
  ) returning id into new_document_id;

  insert into public.case_events(
    case_id,event_type,title,description,visibility,actor_id,metadata
  ) values(
    p_case_id,
    'document_uploaded',
    'Documentación incorporada al expediente',
    btrim(p_original_name),
    'client',
    p_admin_id,
    jsonb_build_object(
      'document_id',new_document_id,
      'intake_channel','received_by_ratio'
    )
  );

  if target_case.client_id is not null then
    insert into public.notifications(
      user_id,case_id,notification_type,title,body,external_hint
    ) values(
      target_case.client_id,
      p_case_id,
      'document_uploaded',
      'Documento incorporado a tu expediente',
      btrim(p_original_name),
      'Puedes consultarlo dentro de la documentación de tu expediente.'
    );
  end if;

  insert into public.document_access_events(
    case_id,document_id,actor_id,action,details
  ) values(
    p_case_id,new_document_id,p_admin_id,'uploaded',
    jsonb_build_object(
      'mime_type',p_mime_type,
      'size_bytes',p_size_bytes,
      'intake_channel','received_by_ratio'
    )
  );

  insert into public.audit_events(
    case_id,actor_id,action,object_type,object_id,details
  ) values(
    p_case_id,p_admin_id,'client_document_received_by_ratio','case_document',new_document_id::text,
    jsonb_build_object(
      'sha256',p_sha256,
      'mime_type',p_mime_type,
      'size_bytes',p_size_bytes,
      'privacy_notice_version',p_privacy_notice_version
    )
  );

  return new_document_id;
end;
$$;

revoke all on function public.server_register_admin_client_document(
  uuid,uuid,text,text,text,bigint,text,text
) from public,anon,authenticated;
grant execute on function public.server_register_admin_client_document(
  uuid,uuid,text,text,text,bigint,text,text
) to service_role;

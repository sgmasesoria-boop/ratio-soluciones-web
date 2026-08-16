-- Acreditación controlada de contratos firmados físicamente.
-- La firma manual exige conservar el PDF firmado, un acta interna de
-- verificación y la localización del original en papel. Solo service_role
-- puede ejecutar la operación transaccional.

alter table public.case_contracts
  add column if not exists manual_signed_on date,
  add column if not exists manual_original_location text,
  add column if not exists manual_verification_note text,
  add column if not exists manual_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists manual_verified_at timestamptz;

alter table public.case_contracts
  add constraint case_contracts_manual_location_check
    check (manual_original_location is null or char_length(btrim(manual_original_location)) between 5 and 300),
  add constraint case_contracts_manual_note_check
    check (manual_verification_note is null or char_length(manual_verification_note) <= 1000),
  add constraint case_contracts_manual_signature_check
    check (
      provider is distinct from 'manual'
      or (
        manual_signed_on is not null
        and manual_original_location is not null
        and manual_verified_by is not null
        and manual_verified_at is not null
      )
    );

create index if not exists case_contracts_manual_verified_by_idx
  on public.case_contracts(manual_verified_by)
  where manual_verified_by is not null;

create or replace function public.server_register_manual_contract_signature(
  p_contract_id uuid,
  p_admin_id uuid,
  p_signed_storage_path text,
  p_signed_sha256 text,
  p_evidence_storage_path text,
  p_evidence_sha256 text,
  p_manual_signed_on date,
  p_original_location text,
  p_verification_note text,
  p_provider_request_id text,
  p_provider_document_id text,
  p_event_sha256 text
) returns uuid
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  target public.case_contracts%rowtype;
  verified_at timestamptz := now();
begin
  select * into target
  from public.case_contracts
  where id=p_contract_id
  for update;

  if target.id is null then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;
  if target.provider_request_id is not null or target.signed_at is not null or target.invalidated_at is not null then
    raise exception 'CONTRACT_NOT_EDITABLE';
  end if;
  if target.unsigned_storage_path is null or target.unsigned_sha256 is null then
    raise exception 'CONTRACT_PDF_REQUIRED';
  end if;
  if p_manual_signed_on is null or p_manual_signed_on > current_date or p_manual_signed_on < date '2000-01-01' then
    raise exception 'INVALID_MANUAL_SIGNATURE_DATE';
  end if;

  update public.case_contracts set
    provider='manual',
    provider_request_id=p_provider_request_id,
    provider_document_id=p_provider_document_id,
    signed_storage_path=p_signed_storage_path,
    signed_sha256=p_signed_sha256,
    evidence_storage_path=p_evidence_storage_path,
    evidence_sha256=p_evidence_sha256,
    signed_at=verified_at,
    manual_signed_on=p_manual_signed_on,
    manual_original_location=btrim(p_original_location),
    manual_verification_note=coalesce(btrim(p_verification_note),''),
    manual_verified_by=p_admin_id,
    manual_verified_at=verified_at
  where id=target.id;

  insert into public.case_contract_signature_events(
    contract_id,provider,provider_event_id,event_label,payload_sha256,occurred_at
  ) values(
    target.id,'manual',p_provider_request_id,'Firma manual verificada',p_event_sha256,verified_at
  );

  insert into public.case_events(
    case_id,event_type,title,description,visibility,actor_id,occurred_at,metadata
  ) values(
    target.case_id,'contract_manual_signature_verified','Contrato firmado manualmente y verificado',
    'Ratio ha archivado el contrato firmado y el acta interna de verificación.',
    'internal',p_admin_id,verified_at,
    jsonb_build_object('contract_id',target.id,'manual_signed_on',p_manual_signed_on)
  );

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    target.case_id,p_admin_id,'contract_manual_signature_verified','case_contract',target.id::text,
    jsonb_build_object(
      'signed_sha256',p_signed_sha256,
      'evidence_sha256',p_evidence_sha256,
      'manual_signed_on',p_manual_signed_on,
      'original_location_recorded',true
    )
  );

  return target.id;
end;
$$;

revoke all on function public.server_register_manual_contract_signature(
  uuid,uuid,text,text,text,text,date,text,text,text,text,text
) from public,anon,authenticated;
grant execute on function public.server_register_manual_contract_signature(
  uuid,uuid,text,text,text,text,date,text,text,text,text,text
) to service_role;


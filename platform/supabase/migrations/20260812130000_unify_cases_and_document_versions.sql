-- Unifica la consulta y el expediente en un unico registro interno.
-- El acceso del cliente queda separado del ciclo de trabajo y solo puede
-- activarse tras confirmar la contratacion.

alter table public.cases alter column client_id drop not null;
alter table public.cases alter column created_by drop not null;

alter table public.cases
  add column contact_phone text,
  add column contact_email text,
  add column contact_province text,
  add column source text,
  add column manual_phase text not null default '',
  add column portal_status text not null default 'disabled'
    check (portal_status in ('disabled','invited','active','suspended','revoked')),
  add column contract_confirmed_at timestamptz,
  add column quoted_amount numeric(12,2) not null default 0
    check (quoted_amount >= 0),
  add column privacy_notice_at timestamptz,
  add column privacy_version text,
  add column legal_basis text not null default 'precontractual_request';

alter table public.cases
  add constraint cases_portal_requires_contract_check check (
    portal_status = 'disabled'
    or (client_id is not null and contract_confirmed_at is not null)
  );

create index cases_contact_email_idx on public.cases(lower(contact_email));
create index cases_contact_phone_idx on public.cases(contact_phone);
create index cases_portal_status_idx on public.cases(portal_status);
create index cases_manual_phase_idx on public.cases(manual_phase);

-- Los expedientes existentes ya proceden de una contratacion. Conservamos su
-- acceso y recuperamos los datos de contacto de la consulta de origen.
update public.cases c
set
  contact_phone = l.phone,
  contact_email = l.email,
  contact_province = l.province,
  source = l.source,
  quoted_amount = l.quoted_amount,
  privacy_notice_at = l.privacy_notice_at,
  privacy_version = l.privacy_version,
  legal_basis = 'contractual_relationship',
  contract_confirmed_at = coalesce(c.contract_confirmed_at,c.opened_at),
  portal_status = 'active'
from public.crm_leads l
where l.converted_case_id = c.id;

update public.cases
set
  contract_confirmed_at=coalesce(contract_confirmed_at,opened_at),
  portal_status='active',
  legal_basis='contractual_relationship'
where client_id is not null;

-- Una consulta que aun no se habia convertido pasa a ser un expediente
-- interno sin cuenta de Auth ni acceso al portal.
insert into public.cases(
  reference,client_id,client_name,title,category,status,summary,created_by,
  contact_phone,contact_email,contact_province,source,manual_phase,
  portal_status,quoted_amount,privacy_notice_at,privacy_version,legal_basis,
  opened_at,created_at,updated_at
)
select
  l.reference,null,l.full_name,left(l.summary,160),l.category,
  case when l.status='lost' then 'not_contracted' else 'open' end,
  l.summary,l.created_by,l.phone,l.email,l.province,l.source,'','disabled',
  l.quoted_amount,l.privacy_notice_at,l.privacy_version,l.legal_basis,
  l.created_at,l.created_at,l.updated_at
from public.crm_leads l
where l.converted_case_id is null
on conflict(reference) do nothing;

update public.crm_leads l
set converted_case_id=c.id
from public.cases c
where l.converted_case_id is null and c.reference=l.reference;

insert into public.case_events(
  case_id,event_type,title,description,visibility,actor_id,occurred_at,metadata
)
select
  c.id,'consultation_received','Consulta inicial recibida',l.summary,'internal',
  l.created_by,l.created_at,jsonb_build_object('source_lead_id',l.id)
from public.crm_leads l
join public.cases c on c.id=l.converted_case_id
where not exists(
  select 1 from public.case_events e
  where e.case_id=c.id and e.metadata->>'source_lead_id'=l.id::text
);

insert into public.case_events(
  case_id,event_type,title,description,visibility,actor_id,occurred_at,metadata
)
select
  c.id,'internal_note','Nota interna',n.body,'internal',n.author_id,n.created_at,
  jsonb_build_object('source_lead_note_id',n.id)
from public.crm_lead_notes n
join public.crm_leads l on l.id=n.lead_id
join public.cases c on c.id=l.converted_case_id
where not exists(
  select 1 from public.case_events e
  where e.case_id=c.id and e.metadata->>'source_lead_note_id'=n.id::text
);

update public.crm_tasks t
set case_id=l.converted_case_id
from public.crm_leads l
where t.lead_id=l.id and t.case_id is null;

update public.cases
set status=case
  when status='archived' then 'archived'
  when status='closed' and client_id is null then 'not_contracted'
  when status='closed' then 'archived'
  else 'open'
end;
alter table public.cases drop constraint if exists cases_status_check;
alter table public.cases add constraint cases_status_check
  check (status in ('open','not_contracted','archived'));

-- El contrato es independiente del estado general del expediente. La causa,
-- el precio y el trabajo se redactan para cada caso; el resto procede de una
-- plantilla juridica versionada. La firma final debe llegar de un proveedor
-- con justificante de evidencias, no de una marca manual en el CRM.
create table public.case_contracts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  template_key text not null default 'ratio-servicios',
  template_version integer not null default 1 check (template_version > 0),
  contract_note text not null default '' check (char_length(contract_note) <= 200),
  signer_full_name text not null check (char_length(btrim(signer_full_name)) between 2 and 160),
  signer_identifier text not null check (char_length(btrim(signer_identifier)) between 5 and 30),
  signer_address text not null check (char_length(btrim(signer_address)) between 5 and 300),
  cause text not null check (char_length(btrim(cause)) between 3 and 600),
  work_scope text not null check (char_length(btrim(work_scope)) between 3 and 4000),
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency text not null default 'EUR' check (currency='EUR'),
  template_snapshot text,
  provider text check (provider is null or char_length(btrim(provider)) between 2 and 80),
  provider_request_id text check (provider_request_id is null or char_length(btrim(provider_request_id)) between 3 and 240),
  provider_document_id text check (provider_document_id is null or char_length(btrim(provider_document_id)) between 3 and 240),
  unsigned_storage_path text,
  unsigned_sha256 text check (unsigned_sha256 is null or unsigned_sha256 ~ '^[0-9a-f]{64}$'),
  signed_storage_path text,
  signed_sha256 text check (signed_sha256 is null or signed_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_storage_path text,
  evidence_sha256 text check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  sent_at timestamptz,
  signed_at timestamptz,
  invalidated_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    signed_at is null
    or (
      provider is not null
      and provider_request_id is not null
      and provider_document_id is not null
      and signed_storage_path is not null and signed_sha256 is not null
      and evidence_storage_path is not null and evidence_sha256 is not null
    )
  )
);

create index case_contracts_case_time_idx on public.case_contracts(case_id,created_at desc);
create unique index case_contracts_provider_request_idx on public.case_contracts(provider,provider_request_id)
  where provider_request_id is not null;
create unique index case_contracts_provider_document_idx on public.case_contracts(provider,provider_document_id)
  where provider_document_id is not null;
create trigger case_contracts_touch before update on public.case_contracts
  for each row execute function private.touch_updated_at();

alter table public.case_contracts enable row level security;
create policy case_contracts_admin_read on public.case_contracts
  for select to authenticated using (private.can_manage_case(case_id));
revoke all privileges on public.case_contracts from public,anon,authenticated;
grant select on public.case_contracts to authenticated;
grant select,insert,update,delete on public.case_contracts to service_role;

-- Registro inmutable de los hechos comunicados por el proveedor de firma.
-- event_label es texto libre porque cada proveedor utiliza eventos distintos;
-- la unicidad del evento y la huella impiden procesarlo dos veces en silencio.
create table public.case_contract_signature_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.case_contracts(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 2 and 80),
  provider_event_id text not null check (char_length(btrim(provider_event_id)) between 3 and 240),
  event_label text not null check (char_length(btrim(event_label)) between 2 and 200),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create index case_contract_signature_events_contract_time_idx
  on public.case_contract_signature_events(contract_id,received_at desc);

alter table public.case_contract_signature_events enable row level security;
create trigger case_contract_signature_events_no_changes
  before update or delete on public.case_contract_signature_events
  for each row execute function private.prevent_audit_changes();
create policy case_contract_signature_events_admin_read
  on public.case_contract_signature_events for select to authenticated
  using (
    exists(
      select 1 from public.case_contracts c
      where c.id=contract_id and private.can_manage_case(c.case_id)
    )
  );
revoke all privileges on public.case_contract_signature_events
  from public,anon,authenticated;
grant select on public.case_contract_signature_events to authenticated;
grant select,insert on public.case_contract_signature_events to service_role;

insert into public.case_contracts(
  case_id,template_key,template_version,contract_note,signer_full_name,signer_identifier,
  signer_address,cause,work_scope,price_amount,
  provider,provider_request_id,provider_document_id,signed_storage_path,signed_sha256,
  evidence_storage_path,evidence_sha256,signed_at,created_by
)
select
  c.id,'legacy-before-versioning',1,'Contrato histórico migrado',c.client_name,'MIGRADO-PENDIENTE-VERIFICAR',
  'Dato migrado: verificar en el contrato original',coalesce(nullif(c.title,''),'Encargo profesional'),
  coalesce(nullif(c.summary,''),'Trabajo descrito en el expediente'),0,
  'legacy','legacy-'||c.id::text,'legacy-document-'||c.id::text,'legacy/'||c.id::text||'/contract.pdf',repeat('0',64),
  'legacy/'||c.id::text||'/evidence.pdf',repeat('0',64),
  coalesce(c.contract_confirmed_at,c.opened_at),coalesce(c.created_by,c.client_id)
from public.cases c
where c.client_id is not null and coalesce(c.created_by,c.client_id) is not null
on conflict do nothing;

-- La anotación libre del CRM nunca concede acceso. Incluso una escritura
-- privilegiada sobre cases necesita un contrato con firma y evidencias.
create or replace function private.enforce_case_portal_signature()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  verified_signature_at timestamptz;
begin
  if new.portal_status <> 'disabled' then
    if new.client_id is null then
      raise exception 'PORTAL_CLIENT_REQUIRED';
    end if;

    select max(c.signed_at) into verified_signature_at
    from public.case_contracts c
    where c.case_id=new.id
      and c.signed_at is not null
      and c.invalidated_at is null
      and c.signed_storage_path is not null
      and c.signed_sha256 is not null
      and c.evidence_storage_path is not null
      and c.evidence_sha256 is not null;

    if verified_signature_at is null then
      raise exception 'PORTAL_VERIFIED_SIGNATURE_REQUIRED';
    end if;

    new.contract_confirmed_at=verified_signature_at;
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_case_portal_signature()
  from public,anon,authenticated;

create trigger cases_require_verified_signature_for_portal
  before insert or update of client_id,portal_status,contract_confirmed_at
  on public.cases
  for each row execute function private.enforce_case_portal_signature();

-- Un documento de trabajo agrupa todas sus versiones. Ni el tipo ni el estado
-- forman un embudo cerrado: Ratio escribe las etiquetas que necesite.
create table public.case_working_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 180),
  document_type text not null default '' check (char_length(document_type) <= 120),
  current_status_label text not null default '' check (char_length(current_status_label) <= 120),
  visibility text not null default 'internal' check (visibility in ('internal','client')),
  created_by uuid not null references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_document_versions (
  id uuid primary key default gen_random_uuid(),
  working_document_id uuid not null references public.case_working_documents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status_label text not null default '' check (char_length(status_label) <= 120),
  change_summary text not null default '' check (char_length(change_summary) <= 800),
  client_visible boolean not null default false,
  draft_content text,
  storage_bucket text,
  storage_path text,
  original_name text,
  mime_type text check (mime_type is null or mime_type in (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf'
  )),
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 15728640),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  source_ai_run_id uuid references public.case_ai_runs(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(working_document_id,version_number),
  check (
    (storage_path is null and storage_bucket is null and original_name is null and mime_type is null and size_bytes is null)
    or
    (storage_path is not null and storage_bucket='case-documents' and original_name is not null and mime_type is not null and size_bytes is not null)
  )
);

create index case_working_documents_case_time_idx
  on public.case_working_documents(case_id,updated_at desc);
create index case_document_versions_document_number_idx
  on public.case_document_versions(working_document_id,version_number desc);
create index case_document_versions_ai_run_idx
  on public.case_document_versions(source_ai_run_id) where source_ai_run_id is not null;

create trigger case_working_documents_touch
  before update on public.case_working_documents
  for each row execute function private.touch_updated_at();

alter table public.case_working_documents enable row level security;
alter table public.case_document_versions enable row level security;

create policy case_working_documents_read_case on public.case_working_documents
  for select to authenticated
  using (
    private.can_manage_case(case_id)
    or (
      visibility='client'
      and published_at is not null
      and private.can_access_case(case_id)
    )
  );

create policy case_document_versions_read_case on public.case_document_versions
  for select to authenticated
  using (
    exists(
      select 1 from public.case_working_documents d
      where d.id=working_document_id
        and (
          private.can_manage_case(d.case_id)
          or (
            case_document_versions.client_visible
            and
            d.visibility='client'
            and d.published_at is not null
            and private.can_access_case(d.case_id)
          )
        )
    )
  );

revoke all privileges on public.case_working_documents,public.case_document_versions
  from public,anon,authenticated;
grant select on public.case_working_documents,public.case_document_versions
  to authenticated;

-- Un usuario cliente solo puede leer un expediente si Ratio ha activado de
-- forma expresa su acceso. Los administradores y profesionales conservan el
-- acceso interno por sus permisos.
create or replace function private.can_access_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(
      select 1 from public.cases c
      where c.id=target_case and c.client_id=uid
        and c.portal_status in ('invited','active')
        and c.contract_confirmed_at is not null
    )
    or exists(
      select 1 from public.case_members m
      where m.case_id=target_case and m.user_id=uid and m.revoked_at is null
    );
$$;

revoke execute on function private.can_access_case(uuid,uuid) from public,anon;
grant execute on function private.can_access_case(uuid,uuid) to authenticated;

-- Las escrituras se realizan desde funciones Edge con service_role despues de
-- exigir administrador y MFA. El navegador solo recibe lectura protegida.
grant select,insert,update,delete on public.case_working_documents,public.case_document_versions
  to service_role;

create or replace function public.server_add_case_document_version(
  p_working_document_id uuid,
  p_admin_id uuid,
  p_status_label text,
  p_change_summary text,
  p_draft_content text,
  p_source_ai_run_id uuid default null
) returns table(version_id uuid,version_number integer)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target public.case_working_documents%rowtype;
  next_version integer;
  new_version_id uuid;
begin
  perform private.assert_active_admin(p_admin_id);
  select * into strict target
  from public.case_working_documents
  where id=p_working_document_id
  for update;

  select coalesce(max(v.version_number),0)+1 into next_version
  from public.case_document_versions v
  where v.working_document_id=p_working_document_id;

  insert into public.case_document_versions(
    working_document_id,version_number,status_label,change_summary,
    draft_content,source_ai_run_id,created_by
  ) values(
    p_working_document_id,next_version,left(btrim(coalesce(p_status_label,'')),120),
    left(btrim(coalesce(p_change_summary,'')),800),p_draft_content,
    p_source_ai_run_id,p_admin_id
  ) returning id into new_version_id;

  update public.case_working_documents
  set current_status_label=left(btrim(coalesce(p_status_label,'')),120)
  where id=p_working_document_id;

  insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
  values(
    target.case_id,p_admin_id,'working_document_version_created',
    'case_document_version',new_version_id::text,
    jsonb_build_object(
      'working_document_id',p_working_document_id,
      'version_number',next_version,
      'status_label',left(btrim(coalesce(p_status_label,'')),120),
      'source_ai_run_id',p_source_ai_run_id
    )
  );

  return query select new_version_id,next_version;
end;
$$;

revoke all on function public.server_add_case_document_version(uuid,uuid,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.server_add_case_document_version(uuid,uuid,text,text,text,uuid)
  to service_role;

notify pgrst, 'reload schema';

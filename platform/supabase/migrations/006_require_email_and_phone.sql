-- La operativa aprobada exige ambos datos para confirmar, contactar y mantener
-- el seguimiento escrito de cada consulta.
do $$
begin
  if exists (
    select 1 from public.crm_leads
    where nullif(btrim(phone),'') is null or nullif(btrim(email),'') is null
  ) then
    raise exception 'CRM_CONTACT_DATA_MUST_BE_COMPLETED';
  end if;
end; $$;

alter table public.crm_leads drop constraint if exists crm_leads_contact_required;
alter table public.crm_leads alter column phone set not null;
alter table public.crm_leads alter column email set not null;
alter table public.crm_leads alter column privacy_version set default 'web-v3';

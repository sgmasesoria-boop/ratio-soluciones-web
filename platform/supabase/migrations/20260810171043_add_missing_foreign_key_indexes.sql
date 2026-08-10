-- Cover foreign-key columns used by joins, cascades and audit lookups.
-- Partial indexes avoid storing rows where an optional relationship is absent.
create index if not exists audit_events_actor_id_idx
  on public.audit_events(actor_id) where actor_id is not null;
create index if not exists case_events_actor_id_idx
  on public.case_events(actor_id) where actor_id is not null;
create index if not exists case_members_assigned_by_idx
  on public.case_members(assigned_by) where assigned_by is not null;
create index if not exists cases_created_by_idx
  on public.cases(created_by);
create index if not exists crm_lead_notes_author_id_idx
  on public.crm_lead_notes(author_id);
create index if not exists crm_leads_converted_case_id_idx
  on public.crm_leads(converted_case_id) where converted_case_id is not null;
create index if not exists crm_leads_created_by_idx
  on public.crm_leads(created_by) where created_by is not null;
create index if not exists crm_tasks_assigned_to_idx
  on public.crm_tasks(assigned_to) where assigned_to is not null;
create index if not exists crm_tasks_case_id_idx
  on public.crm_tasks(case_id) where case_id is not null;
create index if not exists crm_tasks_created_by_idx
  on public.crm_tasks(created_by);
create index if not exists crm_tasks_lead_id_idx
  on public.crm_tasks(lead_id) where lead_id is not null;
create index if not exists notifications_case_id_idx
  on public.notifications(case_id) where case_id is not null;

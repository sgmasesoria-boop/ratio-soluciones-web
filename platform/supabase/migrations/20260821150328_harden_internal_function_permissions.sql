-- Refuerzo de defensa en profundidad para funciones auxiliares y tablas
-- exclusivamente gestionadas por Edge Functions con service_role.

alter function private.is_admin(uuid)
  set search_path = pg_catalog, pg_temp;
alter function private.can_manage_case(uuid,uuid)
  set search_path = pg_catalog, pg_temp;

revoke all on function private.is_admin(uuid) from public, anon;
revoke all on function private.can_manage_case(uuid,uuid) from public, anon;
grant execute on function private.is_admin(uuid) to authenticated, service_role;
grant execute on function private.can_manage_case(uuid,uuid) to authenticated, service_role;

revoke all on table public.case_ai_document_index from public, anon, authenticated;
revoke all on table public.case_ai_jobs from public, anon, authenticated;
revoke all on table public.case_ai_runs from public, anon, authenticated;

grant select, insert, update, delete on table public.case_ai_document_index to service_role;
grant select, insert, update, delete on table public.case_ai_jobs to service_role;
grant select, insert, update, delete on table public.case_ai_runs to service_role;

create policy "deny_direct_access_case_ai_document_index"
  on public.case_ai_document_index
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny_direct_access_case_ai_jobs"
  on public.case_ai_jobs
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "deny_direct_access_case_ai_runs"
  on public.case_ai_runs
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);


-- Endurecimiento de Auth y permisos de Data API para las rutas privadas.

-- Ninguna tabla del CRM o del portal es pÃºblica. Los permisos de tabla y RLS
-- actÃºan conjuntamente: authenticated solo puede leer las filas autorizadas.
revoke all privileges on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

grant select on table
  public.profiles,
  public.cases,
  public.case_members,
  public.case_events,
  public.notifications,
  public.audit_events,
  public.crm_leads,
  public.crm_lead_notes,
  public.crm_tasks
to authenticated;

grant update (read_at) on public.notifications to authenticated;

-- La funciÃ³n de infraestructura que activa RLS no es una operaciÃ³n de usuario
-- y no debe quedar publicada como RPC para visitantes ni usuarios autenticados.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Los triggers usan un search_path fijo para evitar resoluciÃ³n de objetos en
-- esquemas controlables por otros roles.
alter function private.touch_updated_at() set search_path = pg_catalog;
alter function private.prevent_audit_changes() set search_path = pg_catalog;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;
revoke execute on function private.prevent_audit_changes() from public, anon, authenticated;

-- Evita reevaluar auth.uid() para cada fila y mantiene la autorizaciÃ³n ligada
-- al identificador verificado de Supabase Auth, nunca a user_metadata.
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

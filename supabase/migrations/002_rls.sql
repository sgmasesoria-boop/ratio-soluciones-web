-- Seguridad por expediente para el portal simplificado.
create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=uid and p.internal_role='admin' and p.active);
$$;

create or replace function private.can_access_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(select 1 from public.cases c where c.id=target_case and c.client_id=uid)
    or exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null);
$$;

create or replace function private.can_manage_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null and m.membership_role in ('owner','manager','professional'));
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.can_access_case(uuid,uuid) to authenticated;
grant execute on function private.can_manage_case(uuid,uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.case_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id=auth.uid() or private.is_admin());
create policy profiles_admin_all on public.profiles for all to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy cases_read_members on public.cases for select to authenticated
using (private.can_access_case(id));
create policy cases_manage_authorized on public.cases for all to authenticated
using (private.can_manage_case(id)) with check (private.is_admin() or private.can_manage_case(id));

create policy members_read_case on public.case_members for select to authenticated
using (private.can_access_case(case_id));
create policy members_admin_write on public.case_members for all to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy events_read_by_visibility on public.case_events for select to authenticated
using (private.can_access_case(case_id) and (visibility='client' or private.can_manage_case(case_id)));
create policy events_manage_authorized on public.case_events for insert to authenticated
with check (private.can_manage_case(case_id) and actor_id=auth.uid());

create policy notifications_read_self on public.notifications for select to authenticated using (user_id=auth.uid());
create policy notifications_update_self on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy notifications_admin_insert on public.notifications for insert to authenticated with check (private.is_admin());
create policy audit_admin_read on public.audit_events for select to authenticated using (private.is_admin());

revoke insert,update,delete on public.audit_events from authenticated;

-- Exige una sesión AAL2 para cualquier acceso interno. Los clientes mantienen
-- acceso AAL1 exclusivamente a sus propios expedientes y avisos.

create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2'
    and exists(select 1 from public.profiles p where p.id=uid and p.internal_role='admin' and p.active);
$$;

create or replace function private.can_access_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or exists(select 1 from public.cases c where c.id=target_case and c.client_id=uid)
    or (
      coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null)
    );
$$;

create or replace function private.can_manage_case(target_case uuid,uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_admin(uid)
    or (
      coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and exists(select 1 from public.case_members m where m.case_id=target_case and m.user_id=uid and m.revoked_at is null and m.membership_role in ('owner','manager','professional'))
    );
$$;

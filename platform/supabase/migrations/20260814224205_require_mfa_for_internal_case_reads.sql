-- Los clientes contratados acceden a su propio expediente sin MFA.
-- Todo acceso interno por asignacion exige una sesion AAL2.
create or replace function private.can_access_case(
  target_case uuid,
  uid uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_admin(uid)
    or exists(
      select 1
      from public.cases c
      where c.id = target_case
        and c.client_id = uid
        and c.portal_status in ('invited', 'active')
        and c.contract_confirmed_at is not null
    )
    or (
      coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      and exists(
        select 1
        from public.case_members m
        where m.case_id = target_case
          and m.user_id = uid
          and m.revoked_at is null
      )
    );
$$;

revoke all on function private.can_access_case(uuid, uuid) from public, anon;
grant execute on function private.can_access_case(uuid, uuid) to authenticated;

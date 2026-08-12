create or replace function private.prevent_crm_lead_status_regression()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare old_rank integer; new_rank integer;
begin
  if new.status=old.status then return new; end if;
  if old.status='lost' then raise exception 'STATUS_REGRESSION'; end if;
  if old.status='won' then
    if new.status='lost' and old.converted_case_id is null then return new; end if;
    raise exception 'STATUS_REGRESSION';
  end if;
  if new.status='lost' then return new; end if;
  old_rank:=case old.status when 'new' then 0 when 'review' then 1 when 'waiting' then 2 when 'viable' then 3 when 'proposal' then 4 when 'contract' then 5 when 'won' then 6 else -1 end;
  new_rank:=case new.status when 'new' then 0 when 'review' then 1 when 'waiting' then 2 when 'viable' then 3 when 'proposal' then 4 when 'contract' then 5 when 'won' then 6 else -1 end;
  if old_rank<0 or new_rank<=old_rank then raise exception 'STATUS_REGRESSION'; end if;
  return new;
end; $$;

revoke all on function private.prevent_crm_lead_status_regression() from public,anon,authenticated;

create or replace function private.prevent_audit_changes()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  -- La FK audit_events.case_id usa ON DELETE SET NULL. Se permite únicamente
  -- ese desligado técnico: ninguna otra columna puede cambiar y la fila de
  -- auditoría sigue siendo inmutable y no eliminable.
  if tg_op='UPDATE'
     and old.case_id is not null
     and new.case_id is null
     and (to_jsonb(new)-'case_id')=(to_jsonb(old)-'case_id') then
    return new;
  end if;
  raise exception 'audit_events is append-only';
end;
$$;

revoke execute on function private.prevent_audit_changes() from public,anon,authenticated;

comment on function private.prevent_audit_changes()
is 'Impide modificar o borrar auditoría; solo admite desligar case_id por la FK al suprimir un expediente.';

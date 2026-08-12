-- Corrige textos UTF-8 que quedaron almacenados como mojibake en el primer
-- despliegue del flujo documental. No cambia estados ni contenido del cliente.

do $$
declare
  function_oid oid;
  function_sql text;
begin
  foreach function_oid in array array[
    'public.server_create_document_request(uuid,uuid,text,text)'::regprocedure::oid,
    'public.server_register_document_upload(uuid,uuid,uuid,text,text,text,bigint,text)'::regprocedure::oid
  ] loop
    select pg_get_functiondef(function_oid) into function_sql;
    function_sql := replace(replace(function_sql,'DocumentaciÃ³n','Documentación'),'documentaciÃ³n','documentación');
    execute function_sql;
  end loop;
end;
$$;

update public.case_events
set title=replace(title,'DocumentaciÃ³n','Documentación')
where title like '%DocumentaciÃ³n%';

update public.notifications
set title=replace(replace(title,'DocumentaciÃ³n','Documentación'),'documentaciÃ³n','documentación')
where title like '%DocumentaciÃ³n%' or title like '%documentaciÃ³n%';

insert into public.audit_events(case_id,actor_id,action,object_type,object_id,details)
values(
  null,null,'text_encoding_repaired','system_maintenance','document-workflow-utf8',
  jsonb_build_object('scope','case_events_and_notifications','reason','utf8_mojibake')
);

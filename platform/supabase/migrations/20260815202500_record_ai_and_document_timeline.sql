-- La cronología interna debe reflejar el trabajo real efectuado sobre el expediente.
-- Los triggers mantienen la anotación unida a la misma transacción que guarda
-- el análisis o la versión documental, sin depender del navegador.

create or replace function private.record_case_ai_run_timeline()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.status='completed' then
    insert into public.case_events(
      case_id,event_type,title,description,visibility,stage,actor_id,metadata
    ) values(
      new.case_id,
      'ai_analysis_completed',
      'Análisis interno completado',
      'Se ha completado un análisis interno del expediente y el resultado ha quedado guardado.',
      'internal',
      'analysis',
      new.requested_by,
      jsonb_build_object(
        'ai_run_id',new.id,
        'prompt_version',new.prompt_version,
        'model',new.model
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function private.record_case_ai_run_timeline() from public,anon,authenticated;

drop trigger if exists case_ai_runs_record_timeline on public.case_ai_runs;
create trigger case_ai_runs_record_timeline
  after insert on public.case_ai_runs
  for each row execute function private.record_case_ai_run_timeline();

create or replace function private.record_case_document_version_timeline()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target public.case_working_documents%rowtype;
  summary text;
begin
  select * into strict target
  from public.case_working_documents
  where id=new.working_document_id;

  summary='Versión '||new.version_number||' guardada de «'||target.title||'».';
  if nullif(btrim(new.change_summary),'') is not null then
    summary=summary||' '||left(btrim(new.change_summary),800);
  end if;

  insert into public.case_events(
    case_id,event_type,title,description,visibility,stage,actor_id,metadata
  ) values(
    target.case_id,
    'working_document_version_created',
    'Documento de trabajo actualizado',
    summary,
    'internal',
    'document_work',
    new.created_by,
    jsonb_build_object(
      'working_document_id',new.working_document_id,
      'document_version_id',new.id,
      'version_number',new.version_number,
      'source_ai_run_id',new.source_ai_run_id
    )
  );
  return new;
end;
$$;

revoke all on function private.record_case_document_version_timeline() from public,anon,authenticated;

drop trigger if exists case_document_versions_record_timeline on public.case_document_versions;
create trigger case_document_versions_record_timeline
  after insert on public.case_document_versions
  for each row execute function private.record_case_document_version_timeline();

-- Repara únicamente las actuaciones recientes que quedaron guardadas antes de
-- activar los triggers. Las claves de metadata evitan duplicados.
insert into public.case_events(
  case_id,event_type,title,description,visibility,stage,actor_id,occurred_at,metadata
)
select
  run.case_id,
  'ai_analysis_completed',
  'Análisis interno completado',
  'Se ha completado un análisis interno del expediente y el resultado ha quedado guardado.',
  'internal',
  'analysis',
  run.requested_by,
  run.created_at,
  jsonb_build_object('ai_run_id',run.id,'prompt_version',run.prompt_version,'model',run.model)
from public.case_ai_runs run
where run.status='completed'
  and run.created_at >= now()-interval '24 hours'
  and not exists(
    select 1 from public.case_events event
    where event.event_type='ai_analysis_completed'
      and event.metadata->>'ai_run_id'=run.id::text
  );

insert into public.case_events(
  case_id,event_type,title,description,visibility,stage,actor_id,occurred_at,metadata
)
select
  document.case_id,
  'working_document_version_created',
  'Documento de trabajo actualizado',
  'Versión '||version.version_number||' guardada de «'||document.title||'».'||
    case when nullif(btrim(version.change_summary),'') is null then '' else ' '||left(btrim(version.change_summary),800) end,
  'internal',
  'document_work',
  version.created_by,
  version.created_at,
  jsonb_build_object(
    'working_document_id',version.working_document_id,
    'document_version_id',version.id,
    'version_number',version.version_number,
    'source_ai_run_id',version.source_ai_run_id
  )
from public.case_document_versions version
join public.case_working_documents document on document.id=version.working_document_id
where version.created_at >= now()-interval '24 hours'
  and not exists(
    select 1 from public.case_events event
    where event.event_type='working_document_version_created'
      and event.metadata->>'document_version_id'=version.id::text
  );

notify pgrst, 'reload schema';

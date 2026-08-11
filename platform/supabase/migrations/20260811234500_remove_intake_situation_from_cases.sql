-- Los expedientes convertidos antes de simplificar el formulario heredaron
-- la clasificación eliminada en su título y resumen.
update public.cases
set
  title = case
    when title like E'Situación indicada:%\n\nConsulta: %'
      then regexp_replace(title, E'^Situación indicada: [^\n]*\.\n\nConsulta: ', '')
    else 'Consulta inicial'
  end,
  summary = case
    when summary like E'Situación indicada:%\n\nConsulta: %'
      then regexp_replace(summary, E'^Situación indicada: [^\n]*\.\n\nConsulta: ', '')
    else 'Consulta inicial recibida sin explicación escrita.'
  end
where title like 'Situación indicada:%'
   or summary like 'Situación indicada:%';

-- El formulario público ya no clasifica la fase del problema.
-- Conservamos únicamente la explicación libre aportada por la persona.
update public.crm_leads
set summary = case
  when summary like E'Situación indicada:%\n\nConsulta: %'
    then regexp_replace(summary, E'^Situación indicada: [^\n]*\.\n\nConsulta: ', '')
  else 'Consulta inicial recibida sin explicación escrita.'
end
where summary like 'Situación indicada:%';

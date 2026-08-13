import {readFile} from 'node:fs/promises';

const [app,assistant,manager,styles]=await Promise.all([
  readFile(new URL('./app.js',import.meta.url),'utf8'),
  readFile(new URL('./supabase/functions/ai-assist/index.ts',import.meta.url),'utf8'),
  readFile(new URL('./supabase/functions/manage-crm/index.ts',import.meta.url),'utf8'),
  readFile(new URL('./styles.css',import.meta.url),'utf8')
]);

const checks={
  oneVisibleAssistant:app.includes('Asistente integral del expediente')&&!app.includes('Consulta profesional'),
  optionalFreeInstruction:app.includes('id="case-ai-request"')&&app.includes('Déjalo vacío para una revisión completa')&&app.includes('redacta una reclamación'),
  wholeCaseContext:['case_events','document_requests','case_documents','case_internal_documents','case_working_documents','case_document_versions','case_ai_runs'].every(name=>assistant.includes(`from('${name}')`)),
  twoPhasePrivacy:assistant.includes('ratio_private_case_brief')&&assistant.includes('researchOfficialSources')&&assistant.includes('ratio_professional_case_work'),
  officialDomainsOnly:assistant.includes("allowed_domains:OFFICIAL_DOMAINS")&&assistant.includes('officialUrl')&&assistant.includes('verifiedUrls.has(url)'),
  piiGuard:assistant.includes('safeResearchQueries')&&['DNI/NIE','teléfonos','emails','IBAN','direcciones','números de expediente'].every(value=>assistant.includes(value)),
  decisiveOutput:['conclusion','legal_analysis','calculations','deliverable'].every(field=>assistant.includes(field)),
  draftingSupported:['demanda','recurso','reclamacion','alegaciones','escrito'].every(kind=>assistant.includes(`'${kind}'`)),
  noInventedProceduralFacts:assistant.includes('sin fabricar juzgado, procedimiento, fechas, cuantías, hechos o representación'),
  oneHumanReview:assistant.includes('una única revisión profesional')&&app.includes('pendiente de revisión profesional'),
  versionedSave:app.includes("action:'create_working_document'")&&app.includes("action:'add_working_document_version'")&&app.includes('sourceAiRunId:result.run_id')&&manager.includes('p_source_ai_run_id:sourceAiRunId'),
  completedResultRecovery:assistant.includes("body.action==='latest_case_analysis'")&&assistant.includes("action:'ai_case_result_recovered'")&&app.includes("action:'latest_case_analysis'")&&app.includes('renderCaseAiFallback'),
  noAutomaticSubmission:!assistant.includes('enviar al juzgado')&&!assistant.includes('presentar automáticamente'),
  citationsAreClickable:app.includes('ai-official-source')&&app.includes('target="_blank"')&&styles.includes('.ai-official-source'),
  auditTrail:assistant.includes("prompt_version:'ratio-case-v7'")&&assistant.includes('official_source_count')&&assistant.includes('research_query_count')&&assistant.includes('tool_cost_excluded:true')
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({passed:!failures.length,checks,failures},null,2));
if(failures.length)process.exit(1);

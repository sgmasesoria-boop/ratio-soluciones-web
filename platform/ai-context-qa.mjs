import {readFile} from 'node:fs/promises';

const [html,app,manager,assistant]=await Promise.all([
  readFile(new URL('./index.html',import.meta.url),'utf8'),
  readFile(new URL('./app.js',import.meta.url),'utf8'),
  readFile(new URL('./supabase/functions/manage-crm/index.ts',import.meta.url),'utf8'),
  readFile(new URL('./supabase/functions/ai-assist/index.ts',import.meta.url),'utf8')
]);

const checks={
  dialog:html.includes('id="ai-context-dialog"')&&html.includes('id="ai-context-content"')&&html.includes('Solo para Ratio'),
  discoverableButton:app.includes('id="add-ai-context"')&&app.includes("openAiContextDialog(c)"),
  formSubmission:app.includes("action:'add_case_context'")&&app.includes('La API la usará en el próximo análisis'),
  protectedWrite:manager.includes("if(body.action==='add_case_context')")&&manager.includes("event_type:'ai_context'")&&manager.includes("visibility:'internal'")&&manager.includes("action:'ai_context_added'"),
  correctionSemantics:assistant.includes('event_type ai_context')&&assistant.includes('corrección explícita')&&assistant.includes("prompt_version:'ratio-case-v8'")
};

const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
if(failures.length){console.error(JSON.stringify({ok:false,checks,failures},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,checks},null,2));

import {readFile} from 'node:fs/promises';

const [app,html,styles,assistant]=await Promise.all([
  readFile(new URL('./app.js',import.meta.url),'utf8'),
  readFile(new URL('./index.html',import.meta.url),'utf8'),
  readFile(new URL('./styles.css',import.meta.url),'utf8'),
  readFile(new URL('./supabase/functions/ai-assist/index.ts',import.meta.url),'utf8')
]);
const adminLayout=app.match(/\$\('#main'\)\.innerHTML = `\$\{pageHead\('Expedientes',[\s\S]*?Seguimiento y coordinación[\s\S]*?`;/)?.[0]||'';
const checks={
  mainWorkFirst:adminLayout.indexOf('${caseAiPanel()}')>=0&&adminLayout.indexOf('${caseAiPanel()}')<adminLayout.indexOf('Seguimiento y coordinación'),
  chronologySecondary:adminLayout.indexOf('<h2>Cronología</h2>')>adminLayout.indexOf('Información complementaria'),
  ratioRequestsClear:app.includes('<h2>Peticiones de Ratio</h2>'),
  clientRequestsClear:app.includes("isAdmin?'Peticiones del cliente':'Tus peticiones a Ratio'"),
  oldAmbiguousHeadingRemoved:!app.includes('<h2>Hablar sobre tu expediente</h2>'),
  professionalWordAction:html.includes('Descargar Word profesional')&&app.includes("platformApi.invoke('document-export'"),
  secondaryStyling:styles.includes('.case-secondary-group'),
  knownDataReused:assistant.includes('protected_merge_tokens_available')&&assistant.includes('mergeProtectedFields')&&assistant.includes('No escribas [POR COMPLETAR]')
};
const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
console.log(JSON.stringify({passed:!failures.length,checks,failures},null,2));
if(failures.length)process.exit(1);

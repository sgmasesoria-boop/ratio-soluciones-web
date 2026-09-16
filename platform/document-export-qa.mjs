import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildBrandedDocument,safeDocumentFileName,sanitizeDocumentContent} from './supabase/functions/document-export/document-builder.mjs';

const outputRoot=fileURLToPath(new URL('./.qa-document-export/',import.meta.url));
await mkdir(outputRoot,{recursive:true});
let outputDirectory;
if(process.argv[2]){
  outputDirectory=resolve(process.argv[2]);
  const relation=relative(outputRoot,outputDirectory);
  if(!relation||relation.startsWith('..')||isAbsolute(relation))throw new Error('QA_OUTPUT_MUST_BE_NEW_CHILD_DIRECTORY');
  await mkdir(outputDirectory,{recursive:false});
}else outputDirectory=await mkdtemp(join(outputRoot,'offline-'));
const content=`# Informe de valoración

Nota de presentación. Este documento está preparado para su maquetación y exportación a PDF profesional. El logotipo corporativo no se incorpora todavía porque no se ha facilitado el archivo o plantilla gráfica correspondiente.

---

El padre es titular del **50 % en pleno dominio** y del usufructo vitalicio sobre el otro 50 %.

| Titular | Concepto | Importe final |
|---|---|---:|
| Padre | 50 % del total más el usufructo sobre la mitad restante | 23.100 € |
| Hijo 1 | Nuda propiedad sobre una cuarta parte | 9.450 € |
| Hijo 2 | Nuda propiedad sobre una cuarta parte | 9.450 € |

El usufructo se valora en el 10 % de la mitad afectada, equivalente al 5 % del precio total. Por ello, al padre le corresponde el 55 % del total: 23.100 €. Los dos hijos reciben el 22,5 % cada uno: 9.450 €. La suma asciende a 42.000 €.

## Base del porcentaje

El 10 % no se suma al 50 % del total: se aplica exclusivamente a la mitad usufructuada.`;
const metadata={title:'Informe de valoración del usufructo',documentType:'analysis',reference:'RS-2026-PRUEBA',clientName:'Persona ficticia de prueba',versionNumber:3,statusLabel:'Borrador generado · pendiente de revisión profesional',dateLabel:'15 de agosto de 2026'};
const bytes=await buildBrandedDocument(metadata,content);
if(bytes.length<5000||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('El generador no produjo un DOCX válido.');
const filename=safeDocumentFileName(metadata.title,metadata.reference,metadata.versionNumber);
const target=resolve(outputDirectory,filename);
await writeFile(target,bytes);
const app=await readFile('app.js','utf8'),html=await readFile('index.html','utf8'),config=await readFile('supabase/config.toml','utf8'),edge=await readFile('supabase/functions/document-export/index.ts','utf8');
const checks={
  professionalDownloadButton:html.includes('Descargar Word profesional')&&app.includes("platformApi.invoke('document-export'"),
  protectedAdminExport:edge.includes('requireAdmin(request)')&&config.includes('[functions.document-export]'),
  auditTrail:edge.includes("action:'working_document_exported'"),
  corporateBrand:bytes.length>5000,
  safeFileName:filename==='RS-2026-PRUEBA-Informe-de-valoracion-del-usufructo-v3.docx',
  presentationNoteRemoved:!sanitizeDocumentContent(content).includes('Nota de presentación'),
  markdownRuleRemoved:!sanitizeDocumentContent(content).split('\n').some(line=>/^---+$/.test(line.trim())),
  internalMetadataHidden:!app.includes("text:'BORRADOR · PENDIENTE DE REVISIÓN PROFESIONAL'")
};
console.log(JSON.stringify({target,bytes:bytes.length,checks},null,2));
if(Object.values(checks).some(value=>!value))process.exitCode=1;

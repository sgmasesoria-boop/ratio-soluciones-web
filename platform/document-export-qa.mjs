import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildBrandedDocument,safeDocumentFileName} from './supabase/functions/document-export/document-builder.mjs';

const outputDirectory=resolve(process.argv[2]||'.qa-document-export');
await rm(outputDirectory,{recursive:true,force:true});
await mkdir(outputDirectory,{recursive:true});
const content=`AL JUZGADO QUE POR TURNO CORRESPONDA

D.ª **Sandra Torres Moreno**, cuyos datos constan en el expediente, comparece y como mejor proceda en Derecho,

EXPONE

1. Que la documentación aportada acredita la relación contractual examinada.
2. Que se solicita la revisión profesional de las cantidades y comunicaciones incorporadas al expediente.

FUNDAMENTOS

- Normativa aplicable comprobada en fuentes oficiales.
- Documentación y cronología del expediente.

SUPLICO AL JUZGADO

Que tenga por presentado este borrador y acuerde lo que proceda tras su revisión profesional.`;
const metadata={title:'Borrador de escrito de reclamación',documentType:'Escrito',reference:'RS-2026-PRUEBA',clientName:'Sandra Torres Moreno',versionNumber:3,statusLabel:'Borrador revisado',dateLabel:'13 de agosto de 2026'};
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
  safeFileName:filename==='RS-2026-PRUEBA-Borrador-de-escrito-de-reclamacion-v3.docx'
};
console.log(JSON.stringify({target,bytes:bytes.length,checks},null,2));
if(Object.values(checks).some(value=>!value))process.exitCode=1;

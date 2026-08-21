import {readFile} from 'node:fs/promises';

const configSource=await readFile(new URL('./config.production.public.js',import.meta.url),'utf8');
const url=configSource.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const apiKey=configSource.match(/supabaseAnonKey:\s*'([^']+)'/)?.[1];

if(!url||!apiKey)throw new Error('No se pudo cargar la configuración pública de producción.');

const probes=[
  ['document-workflow',{action:'download_document',documentId:'00000000-0000-4000-8000-000000000000'},401,'UNAUTHORIZED'],
  ['case-communications',{action:'request_communication',caseId:'00000000-0000-4000-8000-000000000000',subject:'Prueba',message:'Prueba de acceso sin sesión'},401,'UNAUTHORIZED'],
  ['contract-signature',{action:'generate_contract_pdf',contractId:'00000000-0000-4000-8000-000000000000'},401,'UNAUTHORIZED'],
  ['signaturit-webhook',{},401,'UNAUTHORIZED']
];

let failed=false;
for(const [name,body,expectedStatus,expectedError] of probes){
  const response=await fetch(`${url}/functions/v1/${name}`,{
    method:'POST',
    headers:{apikey:apiKey,'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(15000)
  });
  let payload={};
  try{payload=await response.json();}catch{/* Una respuesta no JSON también debe fallar. */}
  const passed=response.status===expectedStatus&&payload?.error===expectedError;
  console.log(`${passed?'PASS':'FAIL'} ${name}: HTTP ${response.status} ${String(payload?.error||'SIN_ERROR')}`);
  if(!passed)failed=true;
}

if(failed)process.exitCode=1;

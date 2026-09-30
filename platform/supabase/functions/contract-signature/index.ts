import {PDFDocument,StandardFonts,rgb} from 'npm:pdf-lib@1.17.1';
import {requireAdmin,serviceClient} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';

const BUCKET='case-documents';
const MAX_PDF_BYTES=15*1024*1024;
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validUuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validProviderId=(value:string)=>/^[A-Za-z0-9_-]{3,240}$/.test(value);

async function sha256(bytes:Uint8Array){
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

function providerConfig(){
  const token=(Deno.env.get('SIGNATURIT_ACCESS_TOKEN')||'').trim();
  const eventsUrl=(Deno.env.get('SIGNATURIT_EVENTS_URL')||'').trim();
  const mode=(Deno.env.get('SIGNATURIT_MODE')||'sandbox').trim().toLowerCase();
  const base=mode==='production'?'https://api.signaturit.com':'https://api.sandbox.signaturit.com';
  if(!token||!eventsUrl||!eventsUrl.startsWith('https://'))throw new Error('SIGNATURE_PROVIDER_NOT_CONFIGURED');
  if(mode==='production'&&Deno.env.get('CONTRACT_TEMPLATE_VALIDATED')!=='true')throw new Error('SIGNATURE_PROVIDER_NOT_CONFIGURED');
  return {token,eventsUrl,mode,base};
}

function contractSnapshot(contract:Record<string,unknown>,caseRecord:Record<string,unknown>,validated:boolean){
  const warning=validated?'':'PENDIENTE DE VALIDACION JURIDICA - SOLO PRUEBAS - NO ENVIAR A CLIENTES\n\n';
  return `${warning}CONTRATO DE PRESTACION DE SERVICIOS - RATIO SOLUCIONES

PARTES
De una parte, Sergio Guerrero Martinez, NIF 74645438L, actuando bajo la denominacion Ratio Soluciones. Los datos fiscales y el domicilio definitivo deben constar en la version juridicamente validada.

De otra parte, ${contract.signer_full_name}, con identificacion ${contract.signer_identifier} y domicilio en ${contract.signer_address}.

EXPEDIENTE
Referencia interna: ${caseRecord.reference}.

1. CAUSA DEL ENCARGO
${contract.cause}

2. TRABAJO INCLUIDO
${contract.work_scope}
Solo quedan comprendidas las actuaciones descritas expresamente. Cualquier ampliacion debera aceptarse y documentarse por separado.

3. PROFESIONALES INTERVINIENTES
Ratio asignara profesionales adecuados al asunto. Su identidad, funcion y, cuando corresponda, habilitacion se comunicaran al cliente al realizar la asignacion.

4. PRECIO
Precio cerrado del encargo: ${Number(contract.price_amount).toFixed(2)} EUR. La version juridicamente validada debera concretar impuestos, suplidos, gastos de terceros y forma de pago.

5. COLABORACION DEL CLIENTE
El cliente facilitara informacion veraz y completa y comunicara inmediatamente cualquier notificacion o plazo. La documentacion se entregara mediante el canal privado habilitado por Ratio.

6. INFORMACION Y PORTAL
Tras acreditarse la firma, Ratio podra habilitar el portal privado. El portal mostrara las actuaciones y solicitudes publicadas para el cliente, sin prometer fechas automaticas.

7. AUSENCIA DE GARANTIA DE RESULTADO
Ratio y los profesionales intervinientes asumen las actuaciones contratadas, pero no garantizan resultados que dependan de terceros, administraciones, organos judiciales o circunstancias ajenas a su control.

8. PROTECCION DE DATOS, DESISTIMIENTO Y RECLAMACIONES
La version definitiva incorporara la informacion validada de proteccion de datos, consumidores, desistimiento, reclamaciones, duracion, terminacion y competencia territorial.

FIRMA
El documento se remitira mediante un proveedor de firma electronica. Ratio conservara el PDF enviado, el PDF firmado, el documento probatorio, sus huellas digitales y las fechas verificadas del proceso.`;
}

function wrapLine(text:string,font:any,size:number,maxWidth:number){
  const words=text.split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
  for(const word of words){
    const candidate=line?`${line} ${word}`:word;
    if(font.widthOfTextAtSize(candidate,size)<=maxWidth)line=candidate;
    else{if(line)lines.push(line);line=word;}
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}

async function renderPdf(snapshot:string){
  const pdf=await PDFDocument.create();
  const normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize:[number,number]=[595.28,841.89],margin=54,maxWidth=pageSize[0]-margin*2;
  let page=pdf.addPage(pageSize),y=pageSize[1]-margin;
  const addPage=()=>{page=pdf.addPage(pageSize);y=pageSize[1]-margin;};
  for(const raw of snapshot.split('\n')){
    const heading=/^(CONTRATO|PARTES|EXPEDIENTE|\d+\.|FIRMA)/.test(raw.trim());
    const font=heading?bold:normal,size=heading?11:9.5,lineHeight=heading?16:13;
    if(!raw.trim()){y-=7;continue;}
    for(const line of wrapLine(raw,font,size,maxWidth)){
      if(y<margin+lineHeight)addPage();
      page.drawText(line,{x:margin,y,size,font,color:rgb(.04,.14,.12)});y-=lineHeight;
    }
  }
  for(const [index,item] of pdf.getPages().entries())item.drawText(`Ratio Soluciones · pagina ${index+1} de ${pdf.getPageCount()}`,{x:margin,y:25,size:8,font:normal,color:rgb(.38,.45,.42)});
  return new Uint8Array(await pdf.save({useObjectStreams:false}));
}

function validManualDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=Date.parse(`${value}T12:00:00.000Z`),today=new Date().toISOString().slice(0,10);
  return Number.isFinite(parsed)&&value>='2000-01-01'&&value<=today;
}

function isPdf(bytes:Uint8Array){
  return bytes.length>=5&&new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
}

async function registerManualSignature(request:Request,form:FormData){
  const admin=await requireAdmin(request);
  const contractId=clean(form.get('contractId'),36),signedOn=clean(form.get('signedOn'),10);
  const originalLocation=clean(form.get('originalLocation'),300),verificationNote=clean(form.get('verificationNote'),1000);
  const custodyConfirmed=String(form.get('custodyConfirmed')||'')==='true',file=form.get('file');
  if(!validUuid(contractId)||!validManualDate(signedOn)||originalLocation.length<5||!custodyConfirmed)throw new Error('INVALID_MANUAL_SIGNATURE');
  if(!(file instanceof File)||file.size<100||file.size>MAX_PDF_BYTES)throw new Error('INVALID_MANUAL_SIGNATURE_FILE');
  const contract=await getContract(contractId);
  if(contract.provider_request_id||contract.signed_at||contract.invalidated_at)throw new Error('CONTRACT_NOT_EDITABLE');
  if(!contract.unsigned_storage_path||!contract.unsigned_sha256)throw new Error('CONTRACT_PDF_REQUIRED');
  const signed=new Uint8Array(await file.arrayBuffer());
  if(!isPdf(signed))throw new Error('INVALID_MANUAL_SIGNATURE_FILE');
  const signedHash=await sha256(signed),verifiedAt=new Date().toISOString();
  const providerRequestId=`manual-${crypto.randomUUID()}`,providerDocumentId=`manual-doc-${crypto.randomUUID()}`;
  const signedPath=`${contract.case_id}/contracts/${contract.id}/${providerDocumentId}-signed.pdf`;
  const evidenceText=`ACTA INTERNA DE VERIFICACION DE FIRMA MANUAL - RATIO SOLUCIONES

Expediente: ${contract.cases.reference}
Contrato: ${contract.id}
Firmante: ${contract.signer_full_name}
Fecha declarada de firma: ${signedOn}
Verificado por usuario interno: ${admin.id}
Fecha y hora de verificacion: ${verifiedAt}
Localizacion declarada del original: ${originalLocation}
Huella SHA-256 del PDF firmado: ${signedHash}
Nota interna: ${verificationNote||'Sin observaciones adicionales.'}

Esta acta registra la comprobacion interna y la custodia declarada. No sustituye al contrato firmado ni al original fisico.`;
  const evidence=await renderPdf(evidenceText),evidenceHash=await sha256(evidence);
  const evidencePath=`${contract.case_id}/contracts/${contract.id}/${providerDocumentId}-manual-evidence.pdf`;
  const first=await serviceClient.storage.from(BUCKET).upload(signedPath,signed,{contentType:'application/pdf',cacheControl:'0',upsert:false});
  if(first.error)throw first.error;
  const second=await serviceClient.storage.from(BUCKET).upload(evidencePath,evidence,{contentType:'application/pdf',cacheControl:'0',upsert:false});
  if(second.error){await serviceClient.storage.from(BUCKET).remove([signedPath]);throw second.error;}
  const eventPayload=JSON.stringify({contractId,signedOn,verifiedAt,signedHash,evidenceHash,providerRequestId,providerDocumentId});
  const eventHash=await sha256(new TextEncoder().encode(eventPayload));
  const {data:registered,error:registerError}=await serviceClient.rpc('server_register_manual_contract_signature',{
    p_contract_id:contract.id,p_admin_id:admin.id,p_signed_storage_path:signedPath,p_signed_sha256:signedHash,
    p_evidence_storage_path:evidencePath,p_evidence_sha256:evidenceHash,p_manual_signed_on:signedOn,
    p_original_location:originalLocation,p_verification_note:verificationNote,p_provider_request_id:providerRequestId,
    p_provider_document_id:providerDocumentId,p_event_sha256:eventHash
  });
  if(registerError||!registered){
    await serviceClient.storage.from(BUCKET).remove([signedPath,evidencePath]);
    const known=['CONTRACT_NOT_FOUND','CONTRACT_NOT_EDITABLE','CONTRACT_PDF_REQUIRED','INVALID_MANUAL_SIGNATURE_DATE'].find(code=>registerError?.message?.includes(code));
    throw new Error(known||'INVALID_MANUAL_SIGNATURE');
  }
  return {contractId:contract.id,provider:'manual',signedOn,verifiedAt,signedSha256:signedHash,evidenceSha256:evidenceHash};
}

async function getContract(contractId:string){
  const {data,error}=await serviceClient.from('case_contracts').select('*,cases!inner(id,reference,client_name,contact_email,status)').eq('id',contractId).single();
  if(error||!data)throw new Error('CONTRACT_NOT_FOUND');
  return data as Record<string,any>;
}

async function generateContractPdf(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request),contractId=clean(input.contractId,36);
  if(!validUuid(contractId))throw new Error('INVALID_FIELDS');
  const contract=await getContract(contractId);
  if(contract.provider_request_id||contract.signed_at||contract.invalidated_at)throw new Error('CONTRACT_NOT_EDITABLE');
  const validated=Deno.env.get('CONTRACT_TEMPLATE_VALIDATED')==='true';
  const snapshot=contractSnapshot(contract,contract.cases,validated),pdf=await renderPdf(snapshot);
  if(pdf.length<100||pdf.length>MAX_PDF_BYTES)throw new Error('INVALID_DOCUMENT_FILE');
  const hash=await sha256(pdf),path=`${contract.case_id}/contracts/${contract.id}/${crypto.randomUUID()}-unsigned.pdf`;
  const {error:uploadError}=await serviceClient.storage.from(BUCKET).upload(path,pdf,{contentType:'application/pdf',cacheControl:'0',upsert:false});
  if(uploadError)throw uploadError;
  const previousPath=contract.unsigned_storage_path as string|undefined;
  const {data:updated,error:updateError}=await serviceClient.from('case_contracts').update({template_snapshot:snapshot,unsigned_storage_path:path,unsigned_sha256:hash}).eq('id',contract.id).is('provider_request_id',null).select('id').maybeSingle();
  if(updateError||!updated){await serviceClient.storage.from(BUCKET).remove([path]);if(updateError)throw updateError;throw new Error('CONTRACT_NOT_EDITABLE');}
  await serviceClient.from('audit_events').insert({case_id:contract.case_id,actor_id:admin.id,action:'contract_pdf_generated',object_type:'case_contract',object_id:contract.id,details:{sha256:hash,template_key:contract.template_key,template_version:contract.template_version,validated_template:validated}});
  if(previousPath&&previousPath!==path)await serviceClient.storage.from(BUCKET).remove([previousPath]);
  return {contractId:contract.id,unsignedSha256:hash,templateValidated:validated};
}

async function downloadContractPdf(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request),contractId=clean(input.contractId,36);
  if(!validUuid(contractId))throw new Error('INVALID_FIELDS');
  const contract=await getContract(contractId);
  if(!contract.unsigned_storage_path||!contract.unsigned_sha256)throw new Error('CONTRACT_PDF_REQUIRED');
  const filename=`Contrato-${clean(contract.cases.reference,80).replace(/[^A-Za-z0-9_-]+/g,'-')}.pdf`;
  const {data:signed,error}=await serviceClient.storage.from(BUCKET).createSignedUrl(contract.unsigned_storage_path,60,{download:filename});
  if(error||!signed?.signedUrl)throw error||new Error('CONTRACT_PDF_REQUIRED');
  await serviceClient.from('audit_events').insert({case_id:contract.case_id,actor_id:admin.id,action:'contract_pdf_download_link_created',object_type:'case_contract',object_id:contract.id,details:{expires_in_seconds:60,sha256:contract.unsigned_sha256}});
  return {url:signed.signedUrl,expiresIn:60};
}

async function downloadVerifiedContractFile(request:Request,input:Record<string,unknown>,kind:'signed'|'evidence'){
  const admin=await requireAdmin(request),contractId=clean(input.contractId,36);
  if(!validUuid(contractId))throw new Error('INVALID_FIELDS');
  const contract=await getContract(contractId);
  const path=kind==='signed'?contract.signed_storage_path:contract.evidence_storage_path;
  if(!path||!contract.signed_at)throw new Error('CONTRACT_PDF_REQUIRED');
  const suffix=kind==='signed'?'firmado':'verificacion';
  const filename=`Contrato-${suffix}-${clean(contract.cases.reference,80).replace(/[^A-Za-z0-9_-]+/g,'-')}.pdf`;
  const {data,error}=await serviceClient.storage.from(BUCKET).createSignedUrl(path,60,{download:filename});
  if(error||!data?.signedUrl)throw error||new Error('CONTRACT_PDF_REQUIRED');
  await serviceClient.from('audit_events').insert({case_id:contract.case_id,actor_id:admin.id,action:`contract_${suffix}_download_link_created`,object_type:'case_contract',object_id:contract.id,details:{expires_in_seconds:60}});
  return {url:data.signedUrl,expiresIn:60};
}

async function sendForSignature(request:Request,input:Record<string,unknown>){
  const admin=await requireAdmin(request),contractId=clean(input.contractId,36);
  if(!validUuid(contractId))throw new Error('INVALID_FIELDS');
  const contract=await getContract(contractId);
  if(contract.provider_request_id)throw new Error('CONTRACT_SIGNATURE_ALREADY_SENT');
  if(contract.signed_at||contract.invalidated_at)throw new Error('CONTRACT_NOT_EDITABLE');
  if(!contract.unsigned_storage_path||!contract.unsigned_sha256)throw new Error('CONTRACT_PDF_REQUIRED');
  if(!contract.cases.contact_email)throw new Error('EMAIL_REQUIRED_FOR_PORTAL');
  const provider=providerConfig();
  const {data:blob,error:downloadError}=await serviceClient.storage.from(BUCKET).download(contract.unsigned_storage_path,{}, {cache:'no-store'});
  if(downloadError||!blob)throw downloadError||new Error('CONTRACT_PDF_REQUIRED');
  const bytes=new Uint8Array(await blob.arrayBuffer());
  if(bytes.length<100||bytes.length>MAX_PDF_BYTES||await sha256(bytes)!==contract.unsigned_sha256)throw new Error('CONTRACT_PDF_REQUIRED');
  const form=new FormData();
  form.append('recipients[0][name]',contract.signer_full_name);
  form.append('recipients[0][email]',contract.cases.contact_email);
  form.append('files[0]',new Blob([bytes],{type:'application/pdf'}),`Contrato-${contract.cases.reference}.pdf`);
  form.append('name',`Contrato ${contract.cases.reference}`);
  form.append('subject','Ratio Soluciones · Firma de contrato');
  form.append('body','Hola. Ratio Soluciones te envía el contrato acordado para que puedas revisarlo y firmarlo desde tu móvil u ordenador.');
  form.append('reply_to','clientes@ratiosoluciones.es');
  form.append('events_url',provider.eventsUrl);
  form.append('data[ratio_contract_id]',contract.id);
  form.append('data[ratio_case_reference]',contract.cases.reference);
  const response=await fetch(`${provider.base}/v3/signatures.json`,{method:'POST',headers:{authorization:`Bearer ${provider.token}`},body:form,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('SIGNATURE_PROVIDER_ERROR');
  const result=await response.json();
  const requestId=clean(result?.id,240),documentId=clean(result?.documents?.[0]?.id,240);
  if(!validProviderId(requestId)||!validProviderId(documentId))throw new Error('SIGNATURE_PROVIDER_ERROR');
  const sentAt=new Date().toISOString();
  const {data:updated,error:updateError}=await serviceClient.from('case_contracts').update({provider:'signaturit',provider_request_id:requestId,provider_document_id:documentId,sent_at:sentAt}).eq('id',contract.id).is('provider_request_id',null).select('id').maybeSingle();
  if(updateError)throw updateError;
  if(!updated)throw new Error('CONTRACT_SIGNATURE_ALREADY_SENT');
  await Promise.all([
    serviceClient.from('case_contract_signature_events').insert({contract_id:contract.id,provider:'signaturit',provider_event_id:`request:${requestId}`,event_label:'Solicitud enviada al proveedor',payload_sha256:await sha256(new TextEncoder().encode(`${requestId}:${documentId}`)),occurred_at:sentAt}),
    serviceClient.from('audit_events').insert({case_id:contract.case_id,actor_id:admin.id,action:'contract_signature_requested',object_type:'case_contract',object_id:contract.id,details:{provider:'signaturit',provider_request_id:requestId,provider_document_id:documentId,mode:provider.mode}})
  ]);
  return {contractId:contract.id,sentAt,providerMode:provider.mode};
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  if(request.method!=='POST')return json(request,{error:'METHOD_NOT_ALLOWED'},405);
  try{
    if((request.headers.get('content-type')||'').toLowerCase().includes('multipart/form-data')){
      const form=await request.formData();
      if(clean(form.get('action'),80)==='register_manual_signature')return json(request,await registerManualSignature(request,form),201);
      return json(request,{error:'UNKNOWN_ACTION'},400);
    }
    const input=await request.json();
    if(input.action==='generate_contract_pdf')return json(request,await generateContractPdf(request,input),201);
    if(input.action==='download_contract_pdf')return json(request,await downloadContractPdf(request,input));
    if(input.action==='download_signed_contract')return json(request,await downloadVerifiedContractFile(request,input,'signed'));
    if(input.action==='download_signature_evidence')return json(request,await downloadVerifiedContractFile(request,input,'evidence'));
    if(input.action==='send_contract_signature')return json(request,await sendForSignature(request,input),201);
    return json(request,{error:'UNKNOWN_ACTION'},400);
  }catch(error){return errorJson(request,error);}
});


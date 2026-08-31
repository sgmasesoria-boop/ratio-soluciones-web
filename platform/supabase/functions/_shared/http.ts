const configuredOrigins=(Deno.env.get('ALLOWED_WEB_ORIGINS')||'https://clientes.ratiosoluciones.es,https://crm.ratiosoluciones.es')
  .split(',').map(value=>value.trim()).filter(Boolean);
const allowedOrigins=new Set(configuredOrigins);

function corsHeaders(request:Request){
  const origin=request.headers.get('origin')||'';
  return {
    ...(allowedOrigins.has(origin)?{'access-control-allow-origin':origin,'vary':'Origin'}:{}),
    'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods':'POST, OPTIONS'
  };
}

export function json(request:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders(request),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}

export function handleOptions(request:Request){
  if(request.method!=='OPTIONS')return null;
  if(request.headers.get('origin')&&!allowedOrigins.has(request.headers.get('origin')!))return new Response(null,{status:403,headers:corsHeaders(request)});
  return new Response(null,{status:204,headers:corsHeaders(request)});
}

export function errorJson(request:Request,error:unknown){
  const message=error instanceof Error?error.message:'UNKNOWN';
  if(message==='UNAUTHORIZED')return json(request,{error:'UNAUTHORIZED'},401);
  if(message==='FORBIDDEN')return json(request,{error:'FORBIDDEN'},403);
  if(message==='MFA_REQUIRED')return json(request,{error:'MFA_REQUIRED'},403);
  if(message==='EMAIL_REQUIRED_FOR_PORTAL')return json(request,{error:'EMAIL_REQUIRED_FOR_PORTAL'},409);
  if(message==='LEAD_NOT_CONTRACTED')return json(request,{error:'LEAD_NOT_CONTRACTED'},409);
  if(message==='EMAIL_BELONGS_TO_INTERNAL_USER')return json(request,{error:'EMAIL_BELONGS_TO_INTERNAL_USER'},409);
  if(message==='STATUS_REGRESSION')return json(request,{error:'STATUS_REGRESSION'},409);
  if(message==='CASE_NOT_FOUND')return json(request,{error:'CASE_NOT_FOUND'},404);
  if(message==='CASE_CLOSED')return json(request,{error:'CASE_CLOSED'},409);
  if(message==='DOCUMENT_NOT_FOUND')return json(request,{error:'DOCUMENT_NOT_FOUND'},404);
  if(message==='DOCUMENT_ACCESS_DENIED')return json(request,{error:'DOCUMENT_ACCESS_DENIED'},403);
  if(message==='DOCUMENT_REQUEST_UNAVAILABLE')return json(request,{error:'DOCUMENT_REQUEST_UNAVAILABLE'},409);
  if(message==='PRIVACY_NOTICE_REQUIRED')return json(request,{error:'PRIVACY_NOTICE_REQUIRED'},400);
  if(message==='INVALID_DOCUMENT_REQUEST')return json(request,{error:'INVALID_DOCUMENT_REQUEST'},400);
  if(message==='INVALID_CLIENT_REQUEST')return json(request,{error:'INVALID_CLIENT_REQUEST'},400);
  if(message==='INVALID_CLARIFICATION_RESPONSE')return json(request,{error:'INVALID_CLARIFICATION_RESPONSE'},400);
  if(message==='INVALID_COMMUNICATION_REQUEST')return json(request,{error:'INVALID_COMMUNICATION_REQUEST'},400);
  if(message==='INVALID_COMMUNICATION_RESPONSE')return json(request,{error:'INVALID_COMMUNICATION_RESPONSE'},400);
  if(message==='COMMUNICATION_ACCESS_DENIED')return json(request,{error:'COMMUNICATION_ACCESS_DENIED'},403);
  if(message==='COMMUNICATION_NOT_FOUND')return json(request,{error:'COMMUNICATION_NOT_FOUND'},404);
  if(message==='COMMUNICATION_ALREADY_RESPONDED')return json(request,{error:'COMMUNICATION_ALREADY_RESPONDED'},409);
  if(message==='CLIENT_REQUEST_ACCESS_DENIED')return json(request,{error:'CLIENT_REQUEST_ACCESS_DENIED'},403);
  if(message==='INVALID_DOCUMENT_FILE')return json(request,{error:'INVALID_DOCUMENT_FILE'},400);
  if(message==='INVALID_ADMIN_CLIENT_DOCUMENT')return json(request,{error:'INVALID_ADMIN_CLIENT_DOCUMENT'},400);
  if(message==='INVALID_DOCUMENT_STATUS')return json(request,{error:'INVALID_DOCUMENT_STATUS'},400);
  if(message==='CONTRACT_NOT_FOUND')return json(request,{error:'CONTRACT_NOT_FOUND'},404);
  if(message==='CONTRACT_NOT_EDITABLE')return json(request,{error:'CONTRACT_NOT_EDITABLE'},409);
  if(message==='CONTRACT_PDF_REQUIRED')return json(request,{error:'CONTRACT_PDF_REQUIRED'},409);
  if(message==='CONTRACT_SIGNATURE_ALREADY_SENT')return json(request,{error:'CONTRACT_SIGNATURE_ALREADY_SENT'},409);
  if(message==='INVALID_MANUAL_SIGNATURE')return json(request,{error:'INVALID_MANUAL_SIGNATURE'},400);
  if(message==='INVALID_MANUAL_SIGNATURE_DATE')return json(request,{error:'INVALID_MANUAL_SIGNATURE_DATE'},400);
  if(message==='INVALID_MANUAL_SIGNATURE_FILE')return json(request,{error:'INVALID_MANUAL_SIGNATURE_FILE'},400);
  if(message==='SIGNATURE_PROVIDER_NOT_CONFIGURED')return json(request,{error:'SIGNATURE_PROVIDER_NOT_CONFIGURED'},503);
  if(message==='SIGNATURE_PROVIDER_ERROR')return json(request,{error:'SIGNATURE_PROVIDER_ERROR'},502);
  if(message==='AI_NOT_CONFIGURED')return json(request,{error:'AI_NOT_CONFIGURED'},503);
  if(message==='AI_BUDGET_EXCEEDED')return json(request,{error:'AI_BUDGET_EXCEEDED'},429);
  if(message==='AI_KEY_INVALID')return json(request,{error:'AI_KEY_INVALID'},502);
  if(message==='AI_QUOTA_EXCEEDED')return json(request,{error:'AI_QUOTA_EXCEEDED'},429);
  if(message==='AI_MODEL_UNAVAILABLE')return json(request,{error:'AI_MODEL_UNAVAILABLE'},502);
  if(message==='AI_REQUEST_INVALID')return json(request,{error:'AI_REQUEST_INVALID'},502);
  if(message==='INVALID_LIBRARY_CONTEXT')return json(request,{error:'INVALID_LIBRARY_CONTEXT'},400);
  if(message==='LIBRARY_CONTEXT_IDENTIFIERS_DETECTED')return json(request,{error:'LIBRARY_CONTEXT_IDENTIFIERS_DETECTED'},400);
  if(message==='LIBRARY_CONTEXT_TOO_LARGE')return json(request,{error:'LIBRARY_CONTEXT_TOO_LARGE'},413);
  if(message==='DOCUMENT_INDEX_INCOMPLETE')return json(request,{error:'DOCUMENT_INDEX_INCOMPLETE'},409);
  if(message==='DOCUMENT_REVIEW_PENDING')return json(request,{error:'DOCUMENT_REVIEW_PENDING'},409);
  if(message==='DOCUMENT_FORMAT_UNSUPPORTED')return json(request,{error:'DOCUMENT_FORMAT_UNSUPPORTED'},409);
  if(message==='INDEX_RESPONSE_INCOMPLETE')return json(request,{error:'INDEX_RESPONSE_INCOMPLETE'},502);
  if(message==='INDEX_STORAGE_ERROR')return json(request,{error:'INDEX_STORAGE_ERROR'},502);
  if(message==='INDEX_TEMPORARILY_UNAVAILABLE')return json(request,{error:'INDEX_TEMPORARILY_UNAVAILABLE'},502);
  if(message==='AI_UPSTREAM_ERROR'||message==='AI_INVALID_RESPONSE')return json(request,{error:'AI_TEMPORARILY_UNAVAILABLE'},502);
  const requestId=crypto.randomUUID();
  console.error('Ratio Edge error',{requestId,error});
  return json(request,{error:'INTERNAL_ERROR',requestId},500);
}


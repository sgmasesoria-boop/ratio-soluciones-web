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
  const requestId=crypto.randomUUID();
  console.error('Ratio Edge error',{requestId,error});
  return json(request,{error:'INTERNAL_ERROR',requestId},500);
}

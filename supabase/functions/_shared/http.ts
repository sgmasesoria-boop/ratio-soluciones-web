export const corsHeaders={
  'access-control-allow-origin':'https://clientes.ratiosoluciones.es',
  'access-control-allow-headers':'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-expose-headers':'x-file-name'
};
export function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export function handleOptions(request:Request){return request.method==='OPTIONS'?new Response('ok',{headers:corsHeaders}):null;}

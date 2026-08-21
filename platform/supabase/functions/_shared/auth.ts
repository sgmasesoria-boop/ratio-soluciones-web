import {createClient} from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const serviceClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

export async function requireUser(request:Request){
  const authorization=request.headers.get('authorization');
  const token=authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if(!token) throw new Error('UNAUTHORIZED');
  const {data,error}=await serviceClient.auth.getUser(token);
  if(error||!data.user) throw new Error('UNAUTHORIZED');
  return data.user;
}

function assuranceLevel(request:Request){
  try{
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
    const encoded=token.split('.')[1];
    if(!encoded)return 'aal1';
    const normalized=encoded.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(encoded.length/4)*4,'=');
    return JSON.parse(atob(normalized))?.aal||'aal1';
  }catch{return 'aal1';}
}

export async function requireAdmin(request:Request){
  const user=await requireUser(request);
  if(assuranceLevel(request)!=='aal2')throw new Error('MFA_REQUIRED');
  const {data}=await serviceClient.from('profiles').select('internal_role,active').eq('id',user.id).single();
  if(!data?.active||data.internal_role!=='admin') throw new Error('FORBIDDEN');
  return user;
}

export async function canAccessCase(userId:string,caseId:string){
  const [{data:profile},{data:caseRow}]=await Promise.all([
    serviceClient.from('profiles').select('internal_role,active').eq('id',userId).maybeSingle(),
    serviceClient.from('cases').select('client_id,portal_status,contract_confirmed_at,status').eq('id',caseId).maybeSingle()
  ]);
  const activeClientAccess=caseRow?.client_id===userId
    &&['invited','active'].includes(caseRow.portal_status)
    &&Boolean(caseRow.contract_confirmed_at)
    &&caseRow.status==='open';
  return Boolean(profile?.active&&(profile.internal_role==='admin'||activeClientAccess));
}


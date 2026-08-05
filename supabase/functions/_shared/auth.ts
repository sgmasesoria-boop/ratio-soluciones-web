import {createClient} from 'npm:@supabase/supabase-js@2';

const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const serviceClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});

export async function requireUser(request:Request){
  const authorization=request.headers.get('authorization');
  if(!authorization) throw new Error('UNAUTHORIZED');
  const userClient=createClient(url,anon,{global:{headers:{authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await userClient.auth.getUser();
  if(error||!data.user) throw new Error('UNAUTHORIZED');
  return data.user;
}

export async function requireAdmin(request:Request){
  const user=await requireUser(request);
  const {data}=await serviceClient.from('profiles').select('internal_role,active').eq('id',user.id).single();
  if(!data?.active||data.internal_role!=='admin') throw new Error('FORBIDDEN');
  return user;
}

export async function canAccessCase(userId:string,caseId:string){
  const [{data:profile},{data:caseRow},{data:member}]=await Promise.all([
    serviceClient.from('profiles').select('internal_role,active').eq('id',userId).maybeSingle(),
    serviceClient.from('cases').select('client_id').eq('id',caseId).maybeSingle(),
    serviceClient.from('case_members').select('membership_role').eq('case_id',caseId).eq('user_id',userId).is('revoked_at',null).maybeSingle()
  ]);
  return Boolean(profile?.active&&(profile.internal_role==='admin'||caseRow?.client_id===userId||member));
}

import {serviceClient,requireAdmin} from '../_shared/auth.ts';
import {errorJson,handleOptions,json} from '../_shared/http.ts';

const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const validUuid=(value:string)=>/^[0-9a-f-]{36}$/i.test(value);
const model=Deno.env.get('OPENAI_TRIAGE_MODEL')||'gpt-5.6-luna';
const hardLimit=Math.max(1,Number(Deno.env.get('OPENAI_MONTHLY_HARD_LIMIT_USD')||25));
const inputRate=Math.max(0,Number(Deno.env.get('OPENAI_INPUT_USD_PER_MILLION')||0.2));
const outputRate=Math.max(0,Number(Deno.env.get('OPENAI_OUTPUT_USD_PER_MILLION')||1.2));

const schema={
  type:'object',additionalProperties:false,
  properties:{
    summary:{type:'string',maxLength:700},
    suggested_category:{type:'string',maxLength:100},
    missing_information:{type:'array',items:{type:'string',maxLength:220},maxItems:8},
    questions_for_client:{type:'array',items:{type:'string',maxLength:240},maxItems:8},
    urgency_flags:{type:'array',items:{type:'string',maxLength:220},maxItems:6},
    draft_reply:{type:'string',maxLength:1600},
    suggested_internal_note:{type:'string',maxLength:300},
    caution:{type:'string',maxLength:300}
  },
  required:['summary','suggested_category','missing_information','questions_for_client','urgency_flags','draft_reply','suggested_internal_note','caution']
};

function outputText(payload:any){
  if(typeof payload?.output_text==='string')return payload.output_text;
  for(const item of payload?.output||[])for(const content of item?.content||[])if(content?.type==='output_text'&&typeof content.text==='string')return content.text;
  throw new Error('AI_INVALID_RESPONSE');
}

async function monthlySpend(){
  const now=new Date();
  const monthStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
  const {data,error}=await serviceClient.from('audit_events').select('details').eq('action','ai_lead_analyzed').gte('created_at',monthStart);
  if(error)throw error;
  return (data||[]).reduce((sum,row)=>sum+Number(row.details?.estimated_cost_usd||0),0);
}

Deno.serve(async request=>{
  const options=handleOptions(request);if(options)return options;
  const respond=(body:unknown,status=200)=>json(request,body,status);
  if(request.method!=='POST')return respond({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const admin=await requireAdmin(request);
    const apiKey=Deno.env.get('OPENAI_API_KEY');
    if(!apiKey)throw new Error('AI_NOT_CONFIGURED');
    const body=await request.json();
    const leadId=clean(body.leadId,36);
    if(body.action!=='analyze_lead'||!validUuid(leadId))return respond({error:'INVALID_FIELDS'},400);
    if(await monthlySpend()>=hardLimit)throw new Error('AI_BUDGET_EXCEEDED');

    const {data:lead,error:leadError}=await serviceClient.from('crm_leads')
      .select('id,reference,province,category,summary,status,created_at')
      .eq('id',leadId).single();
    if(leadError||!lead)return respond({error:'LEAD_NOT_FOUND'},404);

    const prompt={
      reference:lead.reference,
      province:lead.province||'No indicada',
      category:lead.category,
      summary:lead.summary,
      crm_status:lead.status,
      received_at:lead.created_at
    };
    const upstream=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
      body:JSON.stringify({
        model,store:false,
        instructions:'Eres un asistente interno de triaje para Ratio Soluciones en España. Analiza solo la información facilitada. No emitas asesoramiento jurídico, médico o financiero definitivo; no determines viabilidad; no prometas resultados; no inventes hechos ni plazos. Señala información faltante y urgencias que una persona debe revisar. Redacta un borrador cercano, claro y prudente. suggested_internal_note debe ser una nota operativa interna, concreta, completa y revisable por una persona. No menciones que eres una IA. No indiques que el cliente puede adjuntar o enviar documentación: todavía no existe un canal documental habilitado. Si hacen falta documentos, indica únicamente que Ratio explicará el medio seguro para aportarlos. La decisión y el envío siempre corresponden a una persona de Ratio.',
        input:JSON.stringify(prompt),
        text:{format:{type:'json_schema',name:'ratio_lead_triage',strict:true,schema}}
      })
    });
    if(!upstream.ok){
      const requestId=upstream.headers.get('x-request-id');
      let upstreamCode='';
      try{upstreamCode=clean((await upstream.json())?.error?.code,80);}catch{/* Nunca se registra el cuerpo ni la clave. */}
      console.error('OpenAI upstream error',{status:upstream.status,requestId,code:upstreamCode||'unknown'});
      if(upstream.status===401)throw new Error('AI_KEY_INVALID');
      if(upstream.status===429)throw new Error('AI_QUOTA_EXCEEDED');
      if(upstream.status===404)throw new Error('AI_MODEL_UNAVAILABLE');
      if(upstream.status===400)throw new Error('AI_REQUEST_INVALID');
      throw new Error('AI_UPSTREAM_ERROR');
    }
    const response=await upstream.json();
    const result=JSON.parse(outputText(response));
    const inputTokens=Number(response.usage?.input_tokens||0),outputTokens=Number(response.usage?.output_tokens||0);
    const estimatedCost=(inputTokens*inputRate+outputTokens*outputRate)/1_000_000;
    await serviceClient.from('audit_events').insert({
      actor_id:admin.id,action:'ai_lead_analyzed',object_type:'crm_lead',object_id:leadId,
      details:{model,prompt_version:'ratio-triage-v1',input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:Number(estimatedCost.toFixed(6)),automatic_write:false}
    });
    return respond({...result,model});
  }catch(error){return errorJson(request,error);}
});

import {unzipSync} from 'npm:fflate@0.8.2';

// Cliente único de IA de Ratio: API de Claude (Anthropic), endpoint Messages.
// La clave solo existe como secreto ANTHROPIC_API_KEY de Supabase.
export const ANTHROPIC_MESSAGES_URL='https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION='2023-06-01';
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);

export type ClaudeBlock=Record<string,unknown>;
export type ClaudeUsage={input_tokens:number;output_tokens:number};

const envNumber=(name:string,fallback:number)=>Math.max(0,Number(Deno.env.get(name)||fallback));
export const aiConfig={
  triageModel:Deno.env.get('ANTHROPIC_TRIAGE_MODEL')||'claude-haiku-4-5-20251001',
  documentModel:Deno.env.get('ANTHROPIC_DOCUMENT_INDEX_MODEL')||'claude-sonnet-5-5',
  professionalModel:Deno.env.get('ANTHROPIC_PROFESSIONAL_MODEL')||'claude-opus-5-5',
  hardLimitUsd:Math.max(1,Number(Deno.env.get('ANTHROPIC_MONTHLY_HARD_LIMIT_USD')||25)),
  // Tarifas orientativas en USD por millón de tokens; ajustables sin tocar código.
  triageInputRate:envNumber('ANTHROPIC_TRIAGE_INPUT_USD_PER_MILLION',1),
  triageOutputRate:envNumber('ANTHROPIC_TRIAGE_OUTPUT_USD_PER_MILLION',5),
  documentInputRate:envNumber('ANTHROPIC_DOCUMENT_INPUT_USD_PER_MILLION',3),
  documentOutputRate:envNumber('ANTHROPIC_DOCUMENT_OUTPUT_USD_PER_MILLION',15),
  professionalInputRate:envNumber('ANTHROPIC_PROFESSIONAL_INPUT_USD_PER_MILLION',5),
  professionalOutputRate:envNumber('ANTHROPIC_PROFESSIONAL_OUTPUT_USD_PER_MILLION',25)
};

export function anthropicKey(){
  const key=Deno.env.get('ANTHROPIC_API_KEY');
  if(!key)throw new Error('AI_NOT_CONFIGURED');
  return key;
}

export function estimateCost(usage:ClaudeUsage,inputRate:number,outputRate:number){
  const cost=(Number(usage.input_tokens||0)*inputRate+Number(usage.output_tokens||0)*outputRate)/1_000_000;
  return Number(cost.toFixed(6));
}

function headers(apiKey:string){
  return {'x-api-key':apiKey,'anthropic-version':ANTHROPIC_VERSION,'content-type':'application/json'};
}

async function failFromUpstream(label:string,upstream:Response,notFoundCode='AI_MODEL_UNAVAILABLE'):Promise<never>{
  const requestId=upstream.headers.get('request-id')||upstream.headers.get('x-request-id');
  let errorType='',message='';
  try{const body=await upstream.json();errorType=clean(body?.error?.type,80);message=clean(body?.error?.message,300);}catch{/* No se registra el cuerpo. */}
  console.error(`${label} upstream error`,{status:upstream.status,requestId,type:errorType||'unknown'});
  if(upstream.status===401||upstream.status===403)throw new Error('AI_KEY_INVALID');
  // Anthropic informa de saldo agotado con 400 y mensaje "credit balance is too low".
  if(upstream.status===402||upstream.status===429||/credit balance|billing|usage limit|rate limit/i.test(message))throw new Error('AI_QUOTA_EXCEEDED');
  if(upstream.status===404)throw new Error(notFoundCode);
  if(upstream.status===400)throw new Error('AI_REQUEST_INVALID');
  throw new Error('AI_UPSTREAM_ERROR');
}

async function post(label:string,apiKey:string,body:unknown){
  const send=()=>fetch(ANTHROPIC_MESSAGES_URL,{method:'POST',headers:headers(apiKey),body:JSON.stringify(body)});
  let upstream=await send();
  // Un único reintento ante saturación o error transitorio del servicio.
  if([500,502,503,529].includes(upstream.status)){await new Promise(resolve=>setTimeout(resolve,1500));upstream=await send();}
  if(!upstream.ok)await failFromUpstream(label,upstream);
  return {response:await upstream.json(),requestId:upstream.headers.get('request-id')||upstream.headers.get('x-request-id')};
}

/** Llamada con salida JSON obligatoria: el modelo debe rellenar la herramienta `toolName` con el esquema dado. */
export async function callClaudeJson(options:{
  apiKey:string;system:string;content:string|ClaudeBlock[];toolName:string;schema:Record<string,unknown>;
  model:string;maxTokens:number;label?:string;
}){
  const {apiKey,system,content,toolName,schema,model,maxTokens,label='Claude'}=options;
  const {response,requestId}=await post(label,apiKey,{
    model,max_tokens:maxTokens,system,
    messages:[{role:'user',content}],
    tools:[{name:toolName,description:'Devuelve el resultado final con exactamente esta estructura.',input_schema:schema}],
    tool_choice:{type:'tool',name:toolName}
  });
  if(response?.stop_reason==='max_tokens'){
    console.error(`${label} response incomplete`,{requestId,responseId:clean(response?.id,100),model,outputLimit:maxTokens});
    throw new Error('AI_RESPONSE_INCOMPLETE');
  }
  const block=(response?.content||[]).find((item:any)=>item?.type==='tool_use'&&item?.name===toolName);
  if(!block||typeof block.input!=='object'||block.input===null||Array.isArray(block.input)){
    console.error(`${label} structured response invalid`,{requestId,responseId:clean(response?.id,100),stop:clean(response?.stop_reason,40),model});
    throw new Error('AI_RESPONSE_INCOMPLETE');
  }
  return {response,result:block.input as Record<string,any>,usage:{input_tokens:Number(response?.usage?.input_tokens||0),output_tokens:Number(response?.usage?.output_tokens||0)}};
}

/** Investigación en fuentes oficiales mediante la herramienta de búsqueda web de Claude, limitada a dominios permitidos. */
export async function callClaudeResearch(options:{
  apiKey:string;system:string;question:string;allowedDomains:string[];model:string;maxTokens:number;
  isAllowedUrl:(value:unknown)=>boolean;
}){
  const {apiKey,system,question,allowedDomains,model,maxTokens,isAllowedUrl}=options;
  const messages:any[]=[{role:'user',content:question}];
  const usage={input_tokens:0,output_tokens:0};
  const found=new Map<string,{url:string;title:string}>();
  const text:string[]=[];
  const add=(url:unknown,title:unknown)=>{
    if(!isAllowedUrl(url))return;
    const value=String(url);
    if(!found.has(value))found.set(value,{url:value,title:clean(title||new URL(value).hostname,240)});
  };
  for(let turn=0;turn<4;turn++){
    const {response}=await post('Official research',apiKey,{
      model,max_tokens:maxTokens,system,messages,
      tools:[{type:'web_search_20250305',name:'web_search',max_uses:8,allowed_domains:allowedDomains}]
    });
    usage.input_tokens+=Number(response?.usage?.input_tokens||0);
    usage.output_tokens+=Number(response?.usage?.output_tokens||0);
    for(const block of response?.content||[]){
      if(block?.type==='text'){
        text.push(String(block.text||''));
        for(const citation of block.citations||[])add(citation?.url,citation?.title);
      }
      if(block?.type==='web_search_tool_result'&&Array.isArray(block.content))for(const hit of block.content)add(hit?.url,hit?.title);
    }
    if(response?.stop_reason!=='pause_turn')break;
    messages.push({role:'assistant',content:response.content});
  }
  return {text:text.join('').trim(),sources:[...found.values()].slice(0,40),usage};
}

export function bytesToBase64(bytes:Uint8Array){
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  return btoa(binary);
}

export const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Texto plano de un DOCX (Claude lee PDF e imágenes de forma nativa; Word se convierte a texto antes de enviarlo). */
export function extractDocxText(bytes:Uint8Array){
  const files=unzipSync(bytes,{filter:file=>/^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/.test(file.name)});
  const decoder=new TextDecoder();
  const decode=(value:string)=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
  const parts:string[]=[];
  for(const name of Object.keys(files).sort((a,b)=>a==='word/document.xml'?-1:b==='word/document.xml'?1:a.localeCompare(b))){
    const xml=decoder.decode(files[name]);
    parts.push(decode(xml
      .replace(/<w:tab\s*\/>/g,'\t').replace(/<w:(?:br|cr)\s*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<\/w:tc>/g,'\t')
      .replace(/<[^>]+>/g,'')).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim());
  }
  const joined=parts.filter(Boolean).join('\n\n');
  if(!joined)throw new Error('INDEX_STORAGE_ERROR');
  return joined.slice(0,400_000);
}

/** Bloque de contenido de Claude para un archivo almacenado, a partir de una URL firmada temporal. */
export async function fileContentBlock(mimeType:string,signedUrl:string):Promise<ClaudeBlock>{
  if(mimeType==='application/pdf')return {type:'document',source:{type:'url',url:signedUrl}};
  if(mimeType==='image/jpeg'||mimeType==='image/png')return {type:'image',source:{type:'url',url:signedUrl}};
  if(mimeType===DOCX_MIME){
    const download=await fetch(signedUrl);
    if(!download.ok)throw new Error('INDEX_STORAGE_ERROR');
    const text=extractDocxText(new Uint8Array(await download.arrayBuffer()));
    return {type:'text',text:`CONTENIDO EXTRAÍDO DE UN DOCUMENTO WORD (sin numeración de página; cita el apartado o párrafo):\n\n${text}`};
  }
  throw new Error('DOCUMENT_FORMAT_UNSUPPORTED');
}

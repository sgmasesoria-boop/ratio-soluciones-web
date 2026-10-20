// Ejecutar con: deno test --allow-env _shared/claude.test.ts  (sin red: fetch simulado)
import {zipSync,strToU8} from 'npm:fflate@0.8.2';
import {callClaudeJson,callClaudeResearch,extractDocxText,fileContentBlock,estimateCost,DOCX_MIME} from './claude.ts';

const assert=(c:unknown,m:string)=>{if(!c)throw new Error('FALLO: '+m);};
const realFetch=globalThis.fetch;
function mock(responses:Array<{status?:number;body:unknown}>,seen:any[]=[]){
  let i=0;
  globalThis.fetch=((url:string,init:any)=>{
    seen.push({url,headers:init?.headers,body:init?.body?JSON.parse(init.body):null});
    const r=responses[Math.min(i++,responses.length-1)];
    return Promise.resolve(new Response(JSON.stringify(r.body),{status:r.status||200,headers:{'content-type':'application/json','request-id':'req_test'}}));
  }) as typeof fetch;
  return seen;
}
const rejectsWith=async(fn:()=>Promise<unknown>,code:string)=>{try{await fn();}catch(e){assert((e as Error).message===code,`esperaba ${code}, llegó ${(e as Error).message}`);return;}throw new Error('FALLO: no lanzó '+code);};
const base={apiKey:'sk-ant-test',system:'s',content:'hola',toolName:'ratio_x',schema:{type:'object',properties:{a:{type:'string'}},required:['a']},model:'claude-sonnet-5-5',maxTokens:100};

Deno.test('salida estructurada por herramienta',async()=>{
  const seen=mock([{body:{id:'m1',stop_reason:'tool_use',usage:{input_tokens:10,output_tokens:5},content:[{type:'tool_use',name:'ratio_x',input:{a:'ok'}}]}}]);
  const out=await callClaudeJson(base);
  assert(out.result.a==='ok','resultado');
  assert(out.usage.input_tokens===10&&out.usage.output_tokens===5,'uso');
  assert(seen[0].url==='https://api.anthropic.com/v1/messages','url');
  assert(seen[0].headers['x-api-key']==='sk-ant-test'&&seen[0].headers['anthropic-version'],'cabeceras');
  assert(seen[0].body.tool_choice.name==='ratio_x'&&seen[0].body.tools[0].input_schema.type==='object','herramienta forzada');
});
Deno.test('errores se traducen a códigos seguros',async()=>{
  mock([{status:400,body:{error:{type:'invalid_request_error',message:'Your credit balance is too low to access the Anthropic API.'}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_QUOTA_EXCEEDED');
  mock([{status:401,body:{error:{type:'authentication_error',message:'x'}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_KEY_INVALID');
  mock([{status:429,body:{error:{type:'rate_limit_error',message:'x'}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_QUOTA_EXCEEDED');
  mock([{status:404,body:{error:{type:'not_found_error',message:'model'}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_MODEL_UNAVAILABLE');
  mock([{status:400,body:{error:{type:'invalid_request_error',message:'bad'}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_REQUEST_INVALID');
  mock([{body:{stop_reason:'max_tokens',content:[{type:'tool_use',name:'ratio_x',input:{}}],usage:{}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_RESPONSE_INCOMPLETE');
  mock([{body:{stop_reason:'end_turn',content:[{type:'text',text:'sin herramienta'}],usage:{}}}]);
  await rejectsWith(()=>callClaudeJson(base),'AI_RESPONSE_INCOMPLETE');
});
Deno.test('reintento único ante 529',async()=>{
  const seen=mock([{status:529,body:{error:{type:'overloaded_error',message:'x'}}},{body:{stop_reason:'tool_use',usage:{input_tokens:1,output_tokens:1},content:[{type:'tool_use',name:'ratio_x',input:{a:'b'}}]}}]);
  const out=await callClaudeJson(base);
  assert(out.result.a==='b'&&seen.length===2,'reintento');
});
Deno.test('investigación oficial: pause_turn y filtrado de dominios',async()=>{
  const isAllowedUrl=(v:unknown)=>{try{return new URL(String(v)).hostname.endsWith('boe.es');}catch{return false;}};
  const seen=mock([
    {body:{stop_reason:'pause_turn',usage:{input_tokens:100,output_tokens:10},content:[{type:'server_tool_use',name:'web_search',input:{query:'q'}}]}},
    {body:{stop_reason:'end_turn',usage:{input_tokens:50,output_tokens:20},content:[
      {type:'web_search_tool_result',content:[{type:'web_search_result',url:'https://www.boe.es/a',title:'BOE A'},{type:'web_search_result',url:'https://malo.example/x',title:'M'}]},
      {type:'text',text:'Art. 1 CC.',citations:[{type:'web_search_result_location',url:'https://www.boe.es/b',title:'BOE B'}]}]}}
  ]);
  const r=await callClaudeResearch({apiKey:'k',system:'s',question:'q',allowedDomains:['boe.es'],model:'m',maxTokens:10,isAllowedUrl});
  assert(seen.length===2,'dos vueltas');
  assert(seen[0].body.tools[0].allowed_domains[0]==='boe.es','dominios');
  assert(r.sources.length===2&&r.sources.every(s=>s.url.includes('boe.es')),'solo fuentes oficiales');
  assert(r.usage.input_tokens===150&&r.usage.output_tokens===30,'uso acumulado');
  assert(r.text==='Art. 1 CC.','texto');
});
Deno.test('DOCX → texto y bloques de archivo',async()=>{
  const xml='<w:document><w:body><w:p><w:r><w:t>Cláusula 1 &amp; única</w:t></w:r></w:p><w:p><w:r><w:t>Segunda</w:t></w:r></w:p></w:body></w:document>';
  const docx=zipSync({'word/document.xml':strToU8(xml),'[Content_Types].xml':strToU8('<x/>')});
  const text=extractDocxText(docx);
  assert(text==='Cláusula 1 & única\nSegunda','texto docx: '+JSON.stringify(text));
  globalThis.fetch=(()=>Promise.resolve(new Response(docx as unknown as BodyInit))) as typeof fetch;
  const b=await fileContentBlock(DOCX_MIME,'https://x/y');
  assert((b as any).type==='text'&&String((b as any).text).includes('Cláusula 1'),'bloque docx');
  const pdf=await fileContentBlock('application/pdf','https://x/z');
  assert((pdf as any).type==='document'&&(pdf as any).source.url==='https://x/z','bloque pdf');
  const img=await fileContentBlock('image/png','https://x/i');
  assert((img as any).type==='image','bloque imagen');
  await rejectsWith(()=>fileContentBlock('text/plain','u'),'DOCUMENT_FORMAT_UNSUPPORTED');
});
Deno.test('coste estimado',()=>{
  assert(estimateCost({input_tokens:1_000_000,output_tokens:1_000_000},3,15)===18,'coste');
  globalThis.fetch=realFetch;
});

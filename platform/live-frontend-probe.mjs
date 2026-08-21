const sites=[
  ['CRM','https://crm.ratiosoluciones.es/'],
  ['Portal','https://clientes.ratiosoluciones.es/']
];

let failed=false;
for(const [label,url] of sites){
  try{
    const htmlResponse=await fetch(`${url}?security_probe=${Date.now()}`,{headers:{'cache-control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(15000)});
    const html=await htmlResponse.text();
    const scriptPath=[...html.matchAll(/<script[^>]+src=["']([^"']*app\.js[^"']*)["']/gi)].at(-1)?.[1]||'app.js';
    const scriptUrl=new URL(scriptPath,htmlResponse.url);
    scriptUrl.searchParams.set('security_probe',String(Date.now()));
    const scriptResponse=await fetch(scriptUrl,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
    const source=await scriptResponse.text();
    const current=source.includes('Preparar documentación')&&source.includes('DOCUMENT_INDEX_INCOMPLETE');
    const passed=htmlResponse.ok&&scriptResponse.ok&&current;
    console.log(`${passed?'PASS':'STALE'} ${label}: HTML ${htmlResponse.status}, JS ${scriptResponse.status}, control documental ${current?'actual':'antiguo'}`);
    if(!passed)failed=true;
  }catch(error){
    failed=true;
    console.log(`FAIL ${label}: ${error instanceof Error?error.message:'error desconocido'}`);
  }
}

if(failed)process.exitCode=1;

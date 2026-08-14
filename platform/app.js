const STORAGE_KEY = 'ratio-platform-crm-v1';
const runtimeConfig = window.RATIO_CONFIG || { mode: 'demo', allowDemoAccess: true };
const productionMode = runtimeConfig.mode === 'production';
const applicationHostname = String(window.location?.hostname || '').toLowerCase();
const hostnameMode = /^(ratio-crm-privado\.|crm\.)/.test(applicationHostname)
  ? 'crm'
  : /^(ratio-portal-pruebas\.|clientes\.)/.test(applicationHostname) ? 'portal' : '';
const applicationMode = hostnameMode || (['crm','portal'].includes(runtimeConfig.appMode) ? runtimeConfig.appMode : 'combined');
let platformApi = null;
if (productionMode) {
  try { platformApi = new window.RatioPlatformApi(runtimeConfig); }
  catch (error) { console.error('ConfiguraciГіn de plataforma no vГЎlida', error); }
}

const now = new Date();
const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60000).toISOString();
const statusLabels = { open:'Abierto', not_contracted:'No contratado', archived:'Archivado' };
const leadStatusLabels = { new:'Nueva', review:'En estudio', waiting:'Falta informaciГіn', viable:'Viable', proposal:'Propuesta enviada', contract:'Contrato pendiente', won:'Contratada', lost:'No viable / cerrada' };
const leadStatusFlow = ['new','review','waiting','viable','proposal','contract','won'];
function canAdvanceLeadStatus(current,next,convertedCaseId=''){
  if(current===next)return true;
  if(current==='lost')return false;
  if(current==='won')return next==='lost'&&!convertedCaseId;
  if(next==='lost')return true;
  return leadStatusFlow.indexOf(next)>leadStatusFlow.indexOf(current);
}
function availableLeadStatuses(current,convertedCaseId=''){
  if(current==='lost')return [current];
  if(current==='won')return convertedCaseId?[current]:[current,'lost'];
  const currentIndex=leadStatusFlow.indexOf(current);
  return [...leadStatusFlow.slice(Math.max(0,currentIndex)),'lost'];
}

const seed = {
  activeRole: null,
  users: {
    client: { id:'usr_client_01', name:'Carlos MartГ­n', initials:'CM', role:'Cliente' },
    admin: { id:'usr_admin_01', name:'Sergio Guerrero', initials:'SG', role:'Gestor' }
  },
  cases: [
    {
      id:'case_01', reference:'RS-2048', clientId:'usr_client_01', client:'Carlos MartГ­n',
      title:'RevisiГіn de financiaciГіn', category:'Banca y financiaciГіn', statusCode:'open',
      status:'Abierto', manualPhase:'RevisiГіn de la financiaciГіn', portalStatus:'active', contractConfirmedAt:iso(4300), openedAt:iso(4320),
      clientNextStep:'No tienes que hacer nada ahora. Te avisaremos cuando exista una novedad o necesitemos una decisiГіn.',
      professionalName:'Laura FernГЎndez Ruiz', professionalTitle:'Letrada responsable',
      professionalRegistration:'ICAGR n.Вє 0000 В· dato ficticio', professionalRegion:'AndalucГ­a'
    },
    {
      id:'case_02', reference:'RS-2051', clientId:'usr_client_02', client:'Ana Romero',
      title:'Incidencia en comunidad de propietarios', category:'Vivienda', statusCode:'open',
      status:'Abierto', manualPhase:'ComprobaciГіn de antecedentes', portalStatus:'active', contractConfirmedAt:iso(7180), openedAt:iso(7200),
      clientNextStep:'Estamos comprobando la informaciГіn inicial. Te avisaremos si necesitamos alguna aclaraciГіn.',
      professionalName:'Miguel Torres SГЎnchez', professionalTitle:'Profesional responsable',
      professionalRegistration:'Dato profesional ficticio', professionalRegion:'Madrid'
    },
    {
      id:'case_03', reference:'RS-2056', clientId:'usr_client_03', client:'Ada Navarro',
      title:'ReclamaciГіn de indemnizaciГіn', category:'Seguros e indemnizaciones', statusCode:'open',
      status:'Abierto', manualPhase:'Respuesta recibida, pendiente de valoraciГіn', portalStatus:'active', contractConfirmedAt:iso(10060), openedAt:iso(10080),
      clientNextStep:'Hemos recibido una respuesta. La estamos valorando antes de explicarte las opciones.',
      professionalName:'Elena Ruiz Moreno', professionalTitle:'Profesional responsable',
      professionalRegistration:'Dato profesional ficticio', professionalRegion:'AndalucГ­a'
    }
  ],
  events: [
    { id:'evt_01', caseId:'case_01', kind:'open', title:'Expediente abierto', description:'Tu acceso privado ha quedado confirmado.', at:iso(4320), done:true },
    { id:'evt_02', caseId:'case_01', kind:'study', title:'InformaciГіn inicial revisada', description:'Hemos situado el problema y definido las primeras comprobaciones.', at:iso(2880), done:true },
    { id:'evt_03', caseId:'case_01', kind:'action', title:'GestiГіn en curso', description:'Estamos revisando las condiciones de la financiaciГіn.', at:iso(180), current:true },
    { id:'evt_04', caseId:'case_02', kind:'open', title:'Expediente abierto', description:'La consulta ha sido aceptada y registrada.', at:iso(7200), done:true },
    { id:'evt_05', caseId:'case_02', kind:'study', title:'InformaciГіn en estudio', description:'Estamos analizando los antecedentes de la comunidad.', at:iso(420), current:true },
    { id:'evt_06', caseId:'case_03', kind:'open', title:'Expediente abierto', description:'La reclamaciГіn ha quedado registrada.', at:iso(10080), done:true },
    { id:'evt_07', caseId:'case_03', kind:'action', title:'ReclamaciГіn presentada', description:'La solicitud de indemnizaciГіn fue comunicada a la entidad.', at:iso(5760), done:true },
    { id:'evt_08', caseId:'case_03', kind:'response', title:'Respuesta recibida', description:'Estamos revisando la contestaciГіn antes de comunicar las opciones.', at:iso(90), current:true }
  ],
  notifications: [{ id:'not_01', userId:'usr_client_01', caseId:'case_01', title:'Nuevo avance en tu expediente', body:'La revisiГіn de la financiaciГіn estГЎ en curso.', at:iso(180), read:false }],
  documentRequests: [
    {id:'req_01',caseId:'case_01',requestType:'document',title:'Contrato de la tarjeta',instructions:'Sube el contrato o la copia mГЎs completa que tengas.',status:'pending',responseText:'',responseAt:'',requestedAt:iso(60)}
  ],
  caseDocuments: [],
  internalDocuments: [],
  communicationRequests: [
    {id:'com_01',caseId:'case_01',requestedBy:'usr_client_01',subject:'Quiero aclarar el siguiente paso',message:'Necesito confirmar si debo conservar los recibos nuevos.',deadlineContext:'No tengo ninguna notificaciГіn con plazo.',availabilityNote:'Preferiblemente por la tarde.',responseText:'Conserva los recibos. No necesitas enviarlos hasta que te lo pidamos desde la plataforma.',respondedAt:iso(30),createdAt:iso(90)}
  ],
  workingDocuments: [],
  documentVersions: [],
  contracts: [],
  leads: [
    { id:'lead_01', reference:'C-2026-001', name:'MarГ­a LГіpez', phone:'600 000 001', email:'maria@example.es', province:'Granada', category:'Banca y financiaciГіn', source:'Formulario web', summary:'Consulta sobre una tarjeta revolving cuya deuda no disminuye.', status:'review', amount:650, privacyNoticeAt:iso(1440), legalBasis:'precontractual_request', createdAt:iso(1440), updatedAt:iso(120), notes:[{id:'note_01',body:'Contacto inicial realizado. Pendiente de comprobaciГіn de viabilidad.',at:iso(120)}] },
    { id:'lead_02', reference:'C-2026-002', name:'Antonio Ruiz', phone:'600 000 002', email:'antonio@example.es', province:'Madrid', category:'Vivienda', source:'RecomendaciГіn', summary:'Necesita orientaciГіn ante un conflicto en su comunidad de propietarios.', status:'new', amount:0, privacyNoticeAt:iso(240), legalBasis:'precontractual_request', createdAt:iso(240), updatedAt:iso(240), notes:[] }
  ],
  tasks: [
    { id:'task_01', caseId:'case_01', title:'Comprobar documentacion financiera', dueDate:new Date(now.getTime()+86400000).toISOString().slice(0,10), priority:'high', completed:false, createdAt:iso(120) },
    { id:'task_02', caseId:'case_02', title:'Revisar antecedentes de la comunidad', dueDate:new Date(now.getTime()+172800000).toISOString().slice(0,10), priority:'normal', completed:false, createdAt:iso(60) }
  ],
  audit: []
};

let state = loadState();
let activeSection = 'overview';
let activeCaseId = state.cases[0]?.id || null;
let leadFilter = 'active';
let caseFilter = 'active';
let caseSearch = '';
let mfaFactorId = '';
let mfaEnrollment = false;
let activeWorkingDocumentVersionId = '';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatDate = value => new Intl.DateTimeFormat('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return structuredClone(seed);
    const leads=(stored.leads||[]).map(lead=>({...lead,privacyNoticeAt:lead.privacyNoticeAt||lead.consentAt||lead.createdAt,legalBasis:lead.legalBasis||'precontractual_request'}));
    const storedCases=stored.cases || [];
    const storedEvents=stored.events || [];
    const newDemoCases=seed.cases.filter(item=>!storedCases.some(saved=>saved.id===item.id));
    const newDemoEvents=seed.events.filter(item=>!storedEvents.some(saved=>saved.id===item.id));
    return { ...structuredClone(seed), ...stored, cases:[...storedCases,...structuredClone(newDemoCases)], events:[...storedEvents,...structuredClone(newDemoEvents)], leads, tasks:stored.tasks || [], documentRequests:stored.documentRequests || structuredClone(seed.documentRequests), caseDocuments:stored.caseDocuments || [], internalDocuments:stored.internalDocuments||[], communicationRequests:stored.communicationRequexгЋy¶‰ћЛkєwµз[Ыќ[ќIС[ќ™YШ[™И\Ъ]›ш )‰ОГB€Щ][Щ[™YYXЪК	ИЩШЭ[Y[ќ]\ШYY™YYXЪЙЛ	РЪYњ[™ИHЫЫ™^pмЫ€H[ќ™YШ[™И[\Ъ]›ш )‰Л	Ъ[™›ЙКNГB€ћ^ГB€ЫЫњЭШ\ЩRYI
	ИЩШЭ[Y[ќ]\ШYXШ\ЩIКKќ[YK™\]Y\ЭYI
	ИЩШЭ[Y[ќ]\ШY\™\]Y\Э	КKќ[YNГB€YЉ›ЩXЭ[Ы“[ЩI‰њ]›Ь›P\J^ГB€]ШZ]]›Ь›P\Kљ[ќ›ЪЩS][\\ќ
	ЩШЭ[Y[ќ]ЫЬљЩ›ЭЙЛ™]И›Ь›Q]J]™[ќЭ\њ™[ќ\™Щ]
JNГB€]ШZ][ќ\”›ЩXЭ[ЫЉ
NШXЭ]™PШ\ЩRYXШ\ЩRYШXЭ]™TЩXЭ[ЫЏIЫЭ™\ќљY]ЙОЬ™[™\”Ъ[

NГB€Y[Щ^ГB€ЫЫњЭ][™]И]J
KќТTУФЭљ[™К
KYXЬћ\Лњ[™ЫUURQ

K™\]Y\Э\Э]K™ШЭ[Y[ќ™\]Y\ЭЛ™љ[™
][OOљ][KљYOO\™\]Y\ЭY
NГB€Э]KШ\ЩQШЭ[Y[ќЛќ[њЪYќ
ЪYШ\ЩRY™\]Y\ЭYЬљYЪ[[[YN™љ[K›[YKZ[YU\N™љ[Kќ\KЪ^™Pћ]\О™љ[KњЪ^™KЭ]\О‰Э\ШYY	Л\ШYYћNЭ\њ™[ќ\Щ\Љ
KљYљ]XЮS›ЭXЩP]]Ь™X]Y]]JNГB€YЉ™\]Y\Э
^Ь™\]Y\ЭњЭ]\ПIЬЭX›Z]Y	ОЬ™\]Y\Э™ќ[љ[Y]X]ЯCB€Э]K™]™[ќЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

KШ\ЩRYЪ[™‰ЩШЭ[Y[ќЭ\ШYY	Л]NШЭ[Y[ќXЪpмЫ€[ќ™YШYN€	Ь™\]Y\ЭЛќ]_	Р\Ъ]›ИЫЫXЪ]YЙЯX\ШЬљ\[ЫЋ‰ЙЛ]Э\њ™[ќќќY_JNГB€ЩК	ЩШЭ[Y[ќЭ\ШYY	Л	ШШ\ЩWЩШЭ[Y[ќ	ЛY
NЬШ]™TЭ]J
NЬ™[™\”Ъ[

NГB€CB€	
	ИЩШЭ[Y[ќ]\ШYY›Ь›IКKњ™\Щ]

NЙ
	ИЩШЭ[Y[ќ]\ШYYX[ЩЙКKЫЬЩJ
NЭШ\Э
	Р\Ъ]›И[ќ™YШYИЫЬњ™XЭ[Y[ќHH™YЪ\ЭYИ[€H^YY[ќK‰КNГB€XШ]Ъ
\њ›ЬЉ^ГB€ЫЫњЭY\ЬШYЩ\П^Ф’UђPЦWУ“ХPСWФ‘TURT‘Q‰СX™\ИY\€HXЩ\\€H[™›Ь›XXЪpмЫ€Hљ]XЪYY‰ЛS•ђSQСРХSQS•С’SN‰С[\Ъ]›И›И\И°и[YИИЭ\\HHP‹‰ЛРХSQS•Ф‘TUQTХХSђUђRSP“N‰С\ЭHЫЫXЪ]YXH›ИYZ]H[ќ™YШ\Л‰ЛРХSQS•РPРСTФЧСS’QQ‰У›ИY[™\ИXШЩ\ЫИH\ЭHЫЫXЪ]Y‰ЯNГB€Щ][Щ[™YYXЪК	ИЩШЭ[Y[ќ]\ШYY™YYXЪЙЛY\ЬШYЩ\ЦЩ\њ›ЬЏЛЫЩW_	У›ИЩHHЩYИ[ќ™YШ\€[\Ъ]›Л€›ИИ[ќ°лY\ИЬ€ЫЬњ™[ОИќY[™HH[ќ[ќ\›Л‰КNГB€Yљ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹љ[›™\’S[ЬљYЪ[[ЯCBџJNГB\Ю[Иќ[Э[Ы€ЭЫ›ШYШЭ[Y[ќ
ШЭ[Y[ќYќ]ЫЉ^ГB€ЫЫњЭЬљYЪ[[Xќ]Ы‹ќ^ЫЫќ[ќШќ]Ы‹™\ШX›Y]ќYNШќ]Ы‹ќ^ЫЫќ[ќIФ™\\[™ш )‰ОГB€ћ^ГB€YЉ\›ЩXЭ[Ы“[Щ_\]›Ь›P\J^ЭШ\Э
	УH\ШШ\™ШH™X[ЩHXљ[]H0о›љXШ[Y[ќH[€[Ьќ[ЫЫ™XЭYЛ‰КNЬ™]\›ЋЯCB€ЫЫњЭ™\Э[X]ШZ]]›Ь›P\Kљ[ќ›ЪЩJ	ЩШЭ[Y[ќ]ЫЬљЩ›ЭЙЛШXЭ[ЫЋ‰ЩЭЫ›ШYЩШЭ[Y[ќ	ЛШЭ[Y[ќYJNГB€ЫЫњЭ\›[™]ИT“
™\Э[ќ\›
NГB€YЉ\›њ›ЭШЫЫOOIЪО‰Я]\›љЬЭ[YK™[™ХЪ]
	ЛњЭ\X\ЩKЫЙКJ]›ЭИ™]И\њ›ЬЉ	ТS•ђSQСХУ“РQХT“	КNГB€ЫЫњЭ[љПYШЭ[Y[ќЬ™X]Q[[Y[ќ
	ШIКNЫ[љЛљ™YЏ]\›љ™YЋЫ[љЛќ\™Щ]IЧШ›[љЙОЫ[љЛњ™[IЫ›ЫЬ[™\€›Ь™Y™\њ™\‰ОЩШЭ[Y[ќ›ЩK\[™Ъ[
[љКNЫ[љЛЫXЪК
NЫ[љЛњ™[[Э™J
NГB€Ш\Э
	С[›XЩHЩYЭ\›ИЬ™XYИ\[ќHЊЩYЭ[™ЬЛ‰КNГB€XШ]ЪЭШ\Э
	У›ИЩHHЩYИ™\\\€H\ШШ\™ШHЩYЭ\K‰КNЯCB€љ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹ќ^ЫЫќ[ќ[ЬљYЪ[[ЯCBџCB\Ю[Иќ[Э[Ы€™]љY]СШЭ[Y[ќ
ШЭ[Y[ќYЭ]\Лќ]ЫЉ^ГB€ЫЫњЭЬљYЪ[[Xќ]Ы‹ќ^ЫЫќ[ќШќ]Ы‹™\ШX›Y]ќYNШќ]Ы‹ќ^ЫЫќ[ќIСЭX\™[™ш )‰ОГB€ћ^ГB€YЉ›ЩXЭ[Ы“[ЩI‰њ]›Ь›P\J^Ш]ШZ]]›Ь›P\Kљ[ќ›ЪЩJ	ЩШЭ[Y[ќ]ЫЬљЩ›ЭЙЛШXЭ[ЫЋ‰Ь™]љY]ЧЩШЭ[Y[ќ	ЛШЭ[Y[ќYЭ]\ЯJNШ]ШZ][ќ\”›ЩXЭ[ЫЉ
NШXЭ]™TЩXЭ[ЫЏIШШ\Щ\ЙОШXЭ]™PШ\ЩRY\Э]KШ\ЩQШЭ[Y[ќЛ™љ[™
][OOљ][KљYOOYШЭ[Y[ќY
OЛШ\ЩRYXЭ]™PШ\ЩRYЬ™[™\”Ъ[

NЯCB€[Щ^ШЫЫњЭ][O\Э]KШ\ЩQШЭ[Y[ќЛ™љ[™
ШЭ[Y[ќO™ШЭ[Y[ќљYOOYШЭ[Y[ќY
NЪYЉ][JZ][KњЭ]\П\Э]\ОЬШ]™TЭ]J
NЬ™[™\”Ъ[

NЯCB€Ш\Э
Э]\ПOOIШXШЩ\Y	ПЙСШЭ[Y[ќИ[YYЛ‰О‰СШЭ[Y[ќИX\ШYИ\H™]љ\ЪpмЫ‹‰КNГB€XШ]ЪЭШ\Э
	У›ИЩHHЩYИXЭX[^\€[ШЭ[Y[ќЛ‰КNЯCB€љ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹ќ^ЫЫќ[ќ[ЬљYЪ[[ЯCBџCB\Ю[Иќ[Э[Ы€Ш[Щ[ЫY[ќ™\]Y\Э
™\]Y\ЭYќ]ЫЉ^ГB€YЉ]Ъ[™ЭЛЫЫ™љ\›J	рЇФ™]\\€\ЭHЫЫXЪ]YИ[ЫY[ќH™\°иH]YHXH›ИY[™H]YH™\ЬЫ™\›K‰КJ\™]\›ЋГB€ЫЫњЭЬљYЪ[[Xќ]Ы‹ќ^ЫЫќ[ќШќ]Ы‹™\ШX›Y]ќYNШќ]Ы‹ќ^ЫЫќ[ќIФ™]\[™ш )‰ОГB€ћ^ГB€ЫЫњЭ™\]Y\Э\Э]K™ШЭ[Y[ќ™\]Y\ЭЛ™љ[™
][OOљ][KљYOO\™\]Y\ЭY
NГB€YЉ›ЩXЭ[Ы“[ЩI‰њ]›Ь›P\J^Ш]ШZ]]›Ь›P\Kљ[ќ›ЪЩJ	ЩШЭ[Y[ќ]ЫЬљЩ›ЭЙЛШXЭ[ЫЋ‰ШШ[Щ[Ь™\]Y\Э	Л™\]Y\ЭYJNШ]ШZ][ќ\”›ЩXЭ[ЫЉ
NШXЭ]™PШ\ЩRY\™\]Y\ЭЛШ\ЩRYXЭ]™PШ\ЩRYШXЭ]™TЩXЭ[ЫЏIШШ\Щ\ЙОЬ™[™\”Ъ[

NЯCB€[ЩHYЉ™\]Y\Э
^Ь™\]Y\ЭњЭ]\ПIШШ[Щ[Y	ОШЫЫњЭ][™]И]J
KќТTУФЭљ[™К
NЬЭ]K™]™[ќЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

KШ\ЩRYњ™\]Y\ЭШ\ЩRYЪ[™‰ШЫY[ќЬ™\]Y\ЭШШ[Щ[Y	Л]NЫЫXЪ]Y™]\YN€	Ь™\]Y\Эќ]_X\ШЬљ\[ЫЋ‰ЦXH›И™XЩ\Ъ][[ЬИ\ЭH™\ЬY\ЭK‰Л]Э\њ™[ќќќY_JNЬШ]™TЭ]J
NЬ™[™\”Ъ[

NЯCB€Ш\Э
	ФЫЫXЪ]Y™]\YK€[ЫY[ќHXH›ИY[™H]YH™\ЬЫ™\›K‰КNГB€XШ]ЪЭШ\Э
	У›ИЩHHЩYИ™]\\€HЫЫXЪ]Y‰КNЯCB€љ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹ќ^ЫЫќ[ќ[ЬљYЪ[[ЯCBџCBѓB‰
	ИШЫЫ[][љXШ][Ы‹Y›Ь›IКKY]™[ќ\Э[™\Љ	ЬЭX›Z]	Л\Ю[И]™[ќOћГB€]™[ќњ™]™[ќY][

NЪYЉ]™[ќњЭX›Z]\ЏЛќ[YOOOIШШ[Щ[	К^Й
	ИШЫЫ[][љXШ][Ы‹YX[ЩЙКKЫЬЩJ
NЬ™]\›ЋЯCB€ЫЫњЭ^[ШY^ШXЭ[ЫЋ‰Ь™\]Y\ЭШЫЫ[][љXШ][Ы‰ЛШ\ЩRY‰
	ИШЫЫ[][љXШ][Ы‹XШ\ЩIКKќ[YKЭXљ™XЭ‰
	ИШЫЫ[][љXШ][Ы‹\ЭXљ™XЭ	КKќ[YKќљ[J
KY\ЬШYЩN‰
	ИШЫЫ[][љXШ][Ы‹[Y\ЬШYЩIКKќ[YKќљ[J
KXY[™PЫЫќ^‰
	ИШЫЫ[][љXШ][Ы‹YXY[™IКKќ[YKќљ[J
K]Z[Xљ[]S›ЭN‰
	ИШЫЫ[][љXШ][Ы‹X]Z[Xљ[]IКKќ[YKќљ[J
_NГB€YЉ^[ШYњЭXљ™XЭ›[™ЭЯ^[ШY›Y\ЬШYЩK›[™ЭL
^ЬЩ][Щ[™YYXЪК	ИШЫЫ[][љXШ][Ы‹Y™YYXЪЙЛ	Т[™XШH[\Э[ќИH^XШHњ™]™[Y[ќH]pкH™XЩ\Ъ]\Л‰КNЬ™]\›ЋЯCB€ЫЫњЭќ]ЫЏY]™[ќњЭX›Z]\ЋШЫЫњЭЬљYЪ[[Xќ]Ы‹љ[›™\’SШќ]Ы‹™\ШX›Y]ќYNШќ]Ы‹ќ^ЫЫќ[ќIС[ќљX[™ИЫЫXЪ]Y8 )‰ОГB€ћ^ГB€YЉ›ЩXЭ[Ы“[ЩI‰њ]›Ь›P\J^Ш]ШZ]]›Ь›P\Kљ[ќ›ЪЩJ	ШШ\ЩKXЫЫ[][љXШ][ЫњЙЛ^[ШY
NШ]ШZ][ќ\”›ЩXЭ[ЫЉ
NШXЭ]™PШ\ЩRY\^[ШYШ\ЩRYШXЭ]™TЩXЭ[ЫЏIЫЭ™\ќљY]ЙОЯCB€[Щ^ШЫЫњЭ][™]И]J
KќТTУФЭљ[™К
KYXЬћ\Лњ[™ЫUURQ

NЬЭ]KЫЫ[][љXШ][Ы”™\]Y\ЭЛќ[њЪYќ
ЪYШ\ЩRYњ^[ШYШ\ЩRY™\]Y\ЭYћNЭ\њ™[ќ\Щ\Љ
KљYЭXљ™XЭњ^[ШYњЭXљ™XЭY\ЬШYЩNњ^[ШY›Y\ЬШYЩKXY[™PЫЫќ^њ^[ШY™XY[™PЫЫќ^]Z[Xљ[]S›ЭNњ^[ШY]Z[Xљ[]S›ЭK™\ЬЫњЩU^‰ЙЛ™\ЬЫ™Y]‰ЙЛЬ™X]Y]]JNЬЭ]K››ЭYљXШ][ЫњЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

K\Щ\’YњЭ]Kќ\Щ\њЛYZ[‹љYШ\ЩRYњ^[ШYШ\ЩRY]N‰УќY]HЫЫXЪ]YHЫЫ][љXШXЪpмЫ‰Л›ЩNњ^[ШYњЭXљ™XЭ]™XY™[Щ_JNЬЭ]K™]™[ќЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

KШ\ЩRYњ^[ШYШ\ЩRYЪ[™‰ШЫY[ќШЫЫ[][љXШ][Ы—Ь™\]Y\ЭY	Л]N‰ФЫЫXЪ]Y[ќљXYHH][ЙЛ\ШЬљ\[ЫЋњ^[ШYњЭXљ™XЭ]Э\њ™[ќќќY_JNЬШ]™TЭ]J
NЯCB€	
	ИШЫЫ[][љXШ][Ы‹Y›Ь›IКKњ™\Щ]

NЙ
	ИШЫЫ[][љXШ][Ы‹YX[ЩЙКKЫЬЩJ
NЬ™[™\”Ъ[

NЭШ\Э
	ФЫЫXЪ]Y[ќљXYK€]YYH™YЪ\ЭYH[€H^YY[ќK‰КNГB€XШ]Ъ
\њ›ЬЉ^ШЫЫњЭY\ЬШYЩ\П^ТS•ђSQРУУSUS’PРUSУ—Ф‘TUQTХ‰Ф™]љ\ШH[\Э[ќИH[^ИHHЫЫXЪ]Y‰ЛУУSUS’PРUSУ—РPРСTФЧСS’QQ‰У›ИY[™\ИXШЩ\ЫИH\ЭH^YY[ќK‰ЛРTСWРУФСQ‰С[^YY[ќH\Э0иHЩ\њYЛ‰ЯNЬЩ][Щ[™YYXЪК	ИШЫЫ[][љXШ][Ы‹Y™YYXЪЙЛY\ЬШYЩ\ЦЩ\њ›ЬЏЛЫЩW_	У›ИЩHHЩYИ[ќљX\€HЫЫXЪ]Y€ќY[™HH[ќ[ќ\›Л‰КNЯCB€љ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹љ[›™\’S[ЬљYЪ[[ЯCBџJNГBѓB‰
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKY›Ь›IКKY]™[ќ\Э[™\Љ	ЬЭX›Z]	Л\Ю[И]™[ќOћГB€]™[ќњ™]™[ќY][

NЪYЉ]™[ќњЭX›Z]\ЏЛќ[YOOOIШШ[Щ[	К^Й
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKYX[ЩЙКKЫЬЩJ
NЬ™]\›ЋЯCB€ЫЫњЭЫЫ[][љXШ][Ы’YI
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKZY	КKќ[YK™\ЬЫњЩU^I
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩK]^	КKќ[YKќљ[J
NГB€YЉ™\ЬЫњЩU^›[™ЭЉ^ЬЩ][Щ[™YYXЪК	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKY™YYXЪЙЛ	С\ШЬљX™HH™\ЬY\ЭH[ќ\ИH[ќљX\›K‰КNЬ™]\›ЋЯCB€ЫЫњЭќ]ЫЏY]™[ќњЭX›Z]\ЋШЫЫњЭЬљYЪ[[Xќ]Ы‹љ[›™\’SШќ]Ы‹™\ШX›Y]ќYNШќ]Ы‹ќ^ЫЫќ[ќIСЭX\™[™И™\ЬY\Эx )‰ОГB€ћ^ГB€ЫЫњЭ][OJЭ]KЫЫ[][љXШ][Ы”™\]Y\ЭЯЧJK™љ[™
™XЫЬ™Oњ™XЫЬ™љYOOXЫЫ[][љXШ][Ы’Y
NГB€YЉ›ЩXЭ[Ы“[ЩI‰њ]›Ь›P\J^Ш]ШZ]]›Ь›P\Kљ[ќ›ЪЩJ	ШШ\ЩKXЫЫ[][љXШ][ЫњЙЛШXЭ[ЫЋ‰Ь™\ЬЫ™ШЫЫ[][љXШ][Ы‰ЛЫЫ[][љXШ][Ы’Y™\ЬЫњЩU^JNШ]ШZ][ќ\”›ЩXЭ[ЫЉ
NШXЭ]™PШ\ЩRYZ][OЛШ\ЩRYXЭ]™PШ\ЩRYШXЭ]™TЩXЭ[ЫЏIШШ\Щ\ЙОЯCB€[ЩHYЉ][J^Ъ][Kњ™\ЬЫњЩU^\™\ЬЫњЩU^Ъ][Kњ™\ЬЫ™Y][™]И]J
KќТTУФЭљ[™К
NЬЭ]K››ЭYљXШ][ЫњЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

K\Щ\’YњЭ]Kќ\Щ\њЛЫY[ќљYШ\ЩRYљ][KШ\ЩRY]N‰Ф™\ЬY\ЭHHHЫЫXЪ]Y	Л›ЩNљ][KњЭXљ™XЭ]љ][Kњ™\ЬЫ™Y]™XY™[Щ_JNЬЭ]K™]™[ќЛњ\Ъ
ЪYЬћ\Лњ[™ЫUURQ

KШ\ЩRYљ][KШ\ЩRYЪ[™‰ШЫY[ќШЫЫ[][љXШ][Ы—Ь™\ЬЫ™Y	Л]N‰Ф][ИH™\ЬЫ™YИHHЫЫXЪ]Y	Л\ШЬљ\[ЫЋљ][KњЭXљ™XЭ]љ][Kњ™\ЬЫ™Y]Э\њ™[ќќќY_JNЬШ]™TЭ]J
NЯCB€	
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKY›Ь›IКKњ™\Щ]

NЙ
	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKYX[ЩЙКKЫЬЩJ
NЬ™[™\”Ъ[

NЭШ\Э
	Ф™\ЬY\ЭH™YЪ\ЭYHHЫY[ќH]љ\ШYЛ‰КNГB€XШ]Ъ
\њ›ЬЉ^ШЫЫњЭY\ЬШYЩ\П^РУУSUS’PРUSУ—РS‘PQWФ‘TФУ‘Q‰С\ЭHЫЫXЪ]YXHY[™H™\ЬY\ЭK‰ЛУУSUS’PРUSУ—У“ХС“ХS‘‰УHЫЫXЪ]YXH›И\Э0иH\ЬЫљX›K‰ЛQђWФ‘TURT‘Q‰РЫЫ™љ\›XHHќY]›И[ЩYЭ[™ИXЭЬ‹‰ЯNЬЩ][Щ[™YYXЪК	ИШЫЫ[][љXШ][Ы‹\™\ЬЫњЩKY™YYXЪЙЛY\ЬШYЩ\ЦЩ\њ›ЬЏЛЫЩW_	У›ИЩHHЩYИ™YЪ\Э\€H™\ЬY\ЭK‰КNЯCB€љ[[^Шќ]Ы‹™\ШX›YY[ЩNШќ]Ы‹љ[›™\’S[ЬљYЪ[[ЯCBџJNГBѓB‰
	ИЬ\ЬЭЫЬ™Y›Ь›IКKY]™[ќ\Э[™\Љ	ЬЭX›Z]	Л\Ю[И]™[ќOћГB€]™[ќњ™]™[ќY][

NШЫЫњЭ\ЬЭЫЬ™I
	ИЫ™]Л\\ЬЭЫЬ™	КKќ[YKЫЫ™љ\›X][ЫЏI
	ИШЫЫ™љ\›K\\ЬЭЫЬ™	КKќ[YNГB€YЉ\ЬЭЫЬ™OOXЫЫ™љ\›X][ЫЉ^ЭШ\Э
	У\ИЫЫќ\ЩpмX\И›ИЫЪ[ЪY[‹‰КNЬ™]\›ЋЯCB€ЫЫњЭЭX›Z]\ЏY]™[ќњЭX›Z]\ЋЬЭX›Z]\‹™\ШX›Y]ќYNГB€ћ^Ш]ШZ]]›Ь›P\Kќ\]T\ЬЭЫЬ™
\ЬЭЫЬ™
NЙ
	ИЬ\ЬЭЫЬ™Y›Ь›IКKњ™\Щ]

NЙ
	ИЬ\ЬЭЫЬ™YX[ЩЙКKЫЬЩJ
NШ]ШZ][ќ\”›ЩXЭ[ЫЉ
NЭШ\Э
	РXШЩ\ЫИЫЫ™љ\›XYИЫЬњ™XЭ[Y[ќK‰КNЯCB€Ш]Ъ
\њ›ЬЉ^ЭШ\Э
\њ›ЬЏЛЫЩOOOIХСPRЧФTФХУФ‘	ПЙХ\ШH[Y[›ЬИL€Ш\XЭ\™\ЛЫЫ€X^pоњШЭ[KZ[°оњШЭ[K°о›Y\›ИHрл[X›ЫЛЪ[€\ЬXЪ[ЬЛ‰О‰У›ИЩHHЩYИЫЫ™љ\›X\€[XШЩ\ЫЛ‰КNЯCB€љ[[^ЬЭX›Z]\‹™\ШX›YY[ЩNЯCBџJNГB‰
	ИЬ\ЬЭЫЬ™YX[ЩЙКKY]™[ќ\Э[™\Љ	ШШ[Щ[	Л]™[ќO™]™[ќњ™]™[ќY][

JNГB‰
	ИЫYKY›Ь›IКKY]™[ќ\Э[™\Љ	ЬЭX›Z]	Л\Ю[И]™[ќOћГB€]™[ќњ™]™[ќY][

NГB€ЫЫњЭЫЩOI
	ИЫYKXЫЩIКKќ[YKќљ[J
NГB€ЫЫњЭЭX›Z]\ЏY]™[ќњЭX›Z]\ЋЬЭX›Z]\‹™\ШX›Y]ќYNГB€ћ^ГB€ЫЫњЭЪ[[™ЩOX]ШZ]]›Ь›P\KЪ[[™ЩSYJYQXЭЬ’Y
NГB€]ШZ]]›Ь›P\Kќ™\љYћSYJYQXЭЬ’YЪ[[™ЩKљYЫЩJNГB€	
	ИЫYKY›Ь›IКKњ™\Щ]

NЙ
	ИЫYKYX[ЩЙКKЫЬЩJ
NГB€]ШZ][ќ\”›ЩXЭ[ЫЉ
NГB€Ш\Э
YQ[њ›ЫY[ќЙФЩYЭ[™ИXЭЬ€XЭ]YИЫЬњ™XЭ[Y[ќK‰О‰ТY[ќYYЫЫ™љ\›XYHЫЬњ™XЭ[Y[ќK‰КNГB€XШ]Ъ
\њ›ЬЉ^ГB€ЫЫњЭ[ќ[YЫЩOVЙТS•ђSQУQђWРУСIЛ	ЫYWЭ™\љYљXШ][Ы—ЩZ[Y	ЧKљ[ЫY\К\њ›ЬЏЛЫЩJNГB€Ш\Э
[ќ[YЫЩOЙС[рмЩYЫИ[\Ь[›И\И°и[YИИHШYXШYЛ€Xњ™HH\H]][ќXШXЪpмЫ€H[ќ›ЩXЩH[рмЩYЫИќY]›И]YH\\™XЩK‰О‰У›ИЩHHЩYИ™\љYљXШ\€[ЩYЭ[™ИXЭЬ‹€[ќ0к[ќ[ИHќY]›Л‰КNГB€Yљ[[^ЬЭX›Z]\‹™\ШX›YY[ЩNЯCBџJNГB‰
	ИЫYK[ЩЫЭ]	КKY]™[ќ\Э[™\Љ	ШЫXЪЙЛЩЫЭ]
NГB‰
	ИЫYKYX[ЩЙКKY]™[ќ\Э[™\Љ	ШШ[Щ[	Л]™[ќO™]™[ќњ™]™[ќY][

JNГB‰
	ИЫ›ЭYљXШ][Ы‹Xќ]Ы‰КKY]™[ќ\Э[™\Љ	ШЫXЪЙЛ

OOћШXЭ]™TЩXЭ[ЫЏIЫ›ЭYљXШ][ЫњЙОЬ™[™\”Ъ[

NЯJNГBѓBљYЉ›ЩXЭ[Ы“[ЩJ^ГB€	
	Лќ\ЭX[›™\‰КKљY[Џ]ќYNЙ
	Л™[[ЛXXШЩ\ЬЙКKљY[ЏH\ќ[ќ[YPЫЫ™љYЛ[ЭС[[РXШЩ\ЬОГB€YЉ]›Ь›P\J^ГB€ЫЫњЭШ[XЪХ\O\]›Ь›P\KЫЫњЭ[YU\›Щ\ЬЪ[ЫЉШШ][Ы‹љ™YЉNГB€YЉ]›Ь›P\Kњ™\]Z\™\Ф\ЬЭЫЬ™Щ]\
Ш[XЪХ\JJ^ГB€	
	ИЬ\ЬЭЫЬ™YX[ЩЙКKњЪЭУ[Щ[

NГB€™\]Y\Э[љ[X][Ы‘њ[YJ

OO‰
	ИЫ™]Л\\ЬЭЫЬ™	КK™›ШЭ\К
JNГB€Y[ЩH[ќ\”›ЩXЭ[ЫЉ
KШ]Ъ


OOћЯJNГB€CBџY[ЩHYЉЭ]KXЭ]™T›ЫJY[ќ\ЉЭ]KXЭ]™T›ЫJNГB
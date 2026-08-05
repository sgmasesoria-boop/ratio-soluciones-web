const STORAGE_KEY = 'ratio-platform-crm-v1';
const runtimeConfig = window.RATIO_CONFIG || { mode: 'demo', allowDemoAccess: true };
const productionMode = runtimeConfig.mode === 'production';
let platformApi = null;
if (productionMode) {
  try { platformApi = new window.RatioPlatformApi(runtimeConfig); }
  catch (error) { console.error('ConfiguraciÃ³n de plataforma no vÃ¡lida', error); }
}

const now = new Date();
const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60000).toISOString();
const statusLabels = { open:'Abierto', study:'En estudio', action:'Gestiones en curso', response:'Respuesta recibida', resolution:'ResoluciÃ³n', closed:'Cerrado', archived:'Archivado' };
const statusStages = { open:0, study:1, action:2, response:3, resolution:4, closed:5, archived:5 };
const leadStatusLabels = { new:'Nueva', review:'En estudio', waiting:'Falta informaciÃ³n', viable:'Viable', proposal:'Propuesta enviada', contract:'Contrato pendiente', won:'Contratada', lost:'No viable / cerrada' };

const seed = {
  activeRole: null,
  users: {
    client: { id:'usr_client_01', name:'Carlos MartÃ­n', initials:'CM', role:'Cliente' },
    admin: { id:'usr_admin_01', name:'Sergio Guerrero', initials:'SG', role:'Gestor' }
  },
  cases: [{
    id:'case_01', reference:'RS-2048', clientId:'usr_client_01', client:'Carlos MartÃ­n',
    title:'RevisiÃ³n de financiaciÃ³n', category:'Banca y financiaciÃ³n', statusCode:'action',
    status:'Gestiones en curso', stage:2, openedAt:iso(4320),
    clientNextStep:'No tienes que hacer nada ahora. Te avisaremos cuando exista una novedad o necesitemos una decisiÃ³n.',
    professionalName:'Laura FernÃ¡ndez Ruiz', professionalTitle:'Letrada responsable',
    professionalRegistration:'ICAGR n.Âº 0000 Â· dato ficticio', professionalRegion:'AndalucÃ­a'
  }],
  events: [
    { id:'evt_01', caseId:'case_01', kind:'open', title:'Expediente abierto', description:'Tu acceso privado ha quedado confirmado.', at:iso(4320), done:true },
    { id:'evt_02', caseId:'case_01', kind:'study', title:'InformaciÃ³n inicial revisada', description:'Hemos situado el problema y definido las primeras comprobaciones.', at:iso(2880), done:true },
    { id:'evt_03', caseId:'case_01', kind:'action', title:'GestiÃ³n en curso', description:'Estamos revisando las condiciones de la financiaciÃ³n.', at:iso(180), current:true }
  ],
  notifications: [{ id:'not_01', userId:'usr_client_01', caseId:'case_01', title:'Nuevo avance en tu expediente', body:'La revisiÃ³n de la financiaciÃ³n estÃ¡ en curso.', at:iso(180), read:false }],
  leads: [
    { id:'lead_01', reference:'C-2026-001', name:'MarÃ­a LÃ³pez', phone:'600 000 001', email:'maria@example.es', province:'Granada', category:'Banca y financiaciÃ³n', source:'Formulario web', summary:'Consulta sobre una tarjeta revolving cuya deuda no disminuye.', status:'review', nextAction:'Revisar contrato y movimientos indicados durante la llamada', followUp:new Date(now.getTime()+86400000).toISOString().slice(0,10), amount:650, consentAt:iso(1440), createdAt:iso(1440), updatedAt:iso(120), notes:[{id:'note_01',body:'Contacto inicial realizado. Pendiente de comprobaciÃ³n de viabilidad.',at:iso(120)}] },
    { id:'lead_02', reference:'C-2026-002', name:'Antonio Ruiz', phone:'600 000 002', email:'antonio@example.es', province:'Madrid', category:'Vivienda', source:'RecomendaciÃ³n', summary:'Necesita orientaciÃ³n ante un conflicto en su comunidad de propietarios.', status:'new', nextAction:'Realizar primer contacto', followUp:new Date(now.getTime()+172800000).toISOString().slice(0,10), amount:0, consentAt:iso(240), createdAt:iso(240), updatedAt:iso(240), notes:[] }
  ],
  tasks: [
    { id:'task_01', leadId:'lead_01', title:'Comprobar viabilidad de la consulta bancaria', dueDate:new Date(now.getTime()+86400000).toISOString().slice(0,10), priority:'high', completed:false, createdAt:iso(120) },
    { id:'task_02', leadId:'lead_02', title:'Realizar primer contacto', dueDate:new Date(now.getTime()+172800000).toISOString().slice(0,10), priority:'normal', completed:false, createdAt:iso(60) }
  ],
  audit: []
};

let state = loadState();
let activeSection = 'overview';
let activeCaseId = state.cases[0]?.id || null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatDate = value => new Intl.DateTimeFormat('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0].toUpperCase()).join('');
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return structuredClone(seed);
    return { ...structuredClone(seed), ...stored, leads:stored.leads || [], tasks:stored.tasks || [], audit:stored.audit || [] };
  }
  catch { return structuredClone(seed); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function currentUser() { return state.users[state.activeRole]; }
function currentCase() { return state.cases.find(item => item.id === activeCaseId) || state.cases[0]; }
function log(action, objectType, objectId, metadata = {}) {
  state.audit.push({ id:crypto.randomUUID(), actorId:currentUser()?.id, action, objectType, objectId, metadata, at:new Date().toISOString() });
}

function mapProductionWorkspace(workspace, authUser) {
  const profile = workspace.profile || { id:authUser.id, display_name:authUser.email, internal_role:'client' };
  const activeRole = profile.internal_role === 'client' ? 'client' : 'admin';
  const cases = workspace.cases.map(item => ({
    id:item.id, reference:item.reference, clientId:item.client_id,
    client:activeRole === 'client' ? profile.display_name : (item.client_name || 'Cliente asignado'),
    title:item.title, category:item.category, statusCode:item.status,
    status:statusLabels[item.status] || item.status, stage:statusStages[item.status] ?? 0,
    openedAt:item.opened_at, clientNextStep:item.client_next_step || '',
    professionalName:item.professional_name || '', professionalTitle:item.professional_title || '',
    professionalRegistration:item.professional_registration || '', professionalRegion:item.professional_region || ''
  }));
  const events = workspace.events.map(item => ({ id:item.id, caseId:item.case_id, kind:item.event_type, title:item.title, description:item.description || '', at:item.occurred_at, done:false, current:false }));
  cases.forEach(caseItem => {
    const caseEvents = events.filter(item => item.caseId === caseItem.id);
    caseEvents.forEach((item,index) => { item.done=index<caseEvents.length-1; item.current=index===caseEvents.length-1; });
  });
  return {
    activeRole,
    users: {
      client:{ id:profile.id, name:profile.display_name, initials:initials(profile.display_name), role:'Cliente' },
      admin:{ id:profile.id, name:profile.display_name, initials:initials(profile.display_name), role:profile.internal_role === 'admin' ? 'Administrador' : 'Profesional' }
    },
    cases, events,
    notifications:workspace.notifications.map(item => ({ id:item.id, userId:item.user_id, caseId:item.case_id, title:item.title, body:item.body, at:item.created_at, read:Boolean(item.read_at) })),
    leads:(workspace.leads || []).map(item => ({
      id:item.id, reference:item.reference, name:item.full_name, phone:item.phone, email:item.email,
      province:item.province || '', category:item.category, source:item.source, summary:item.summary,
      status:item.status, nextAction:item.next_action || '', followUp:item.follow_up_on || '',
      amount:Number(item.quoted_amount || 0), consentAt:item.consent_at, createdAt:item.created_at,
      updatedAt:item.updated_at, notes:[]
    })),
    tasks:(workspace.tasks || []).map(item => ({ id:item.id, leadId:item.lead_id, title:item.title, dueDate:item.due_on, priority:item.priority, completed:Boolean(item.completed_at), createdAt:item.created_at })),
    audit:[]
  };
}

function enter(role) {
  state.activeRole = role;
  saveState();
  $('#login-view').hidden = true;
  $('#app').hidden = false;
  activeSection = 'overview';
  activeCaseId = state.cases[0]?.id || null;
  renderShell();
}
async function enterProduction() {
  if (!platformApi) throw new Error('La conexiÃ³n segura todavÃ­a no estÃ¡ configurada.');
  const user = await platformApi.currentUser();
  if (!user) return false;
  state = mapProductionWorkspace(await platformApi.loadWorkspace(user.id), user);
  activeCaseId = state.cases[0]?.id || null;
  $('#login-view').hidden = true;
  $('#app').hidden = false;
  activeSection = 'overview';
  renderShell();
  return true;
}
async function logout() {
  if (productionMode && platformApi) await platformApi.signOut();
  state.activeRole = null;
  if (!productionMode) saveState();
  $('#app').hidden = true;
  $('#login-view').hidden = false;
  $('.sidebar').classList.remove('open');
}

function renderShell() {
  const user = currentUser();
  const isAdmin = state.activeRole === 'admin';
  $('#workspace-kicker').textContent = isAdmin ? 'GestiÃ³n interna' : 'Espacio privado';
  $('#workspace-name').textContent = isAdmin ? 'CRM y expedientes' : 'Mi expediente';
  $('#header-kicker').textContent = isAdmin ? 'Ratio Soluciones' : 'Plataforma privada';
  $('#header-title').textContent = isAdmin ? 'CRM y gestiÃ³n de expedientes' : 'Mi expediente';
  $('#profile-initials').textContent = user.initials;
  $('#profile-role').textContent = user.role;
  $('#profile-name').textContent = user.name;
  const unread = state.notifications.filter(n => n.userId === user.id && !n.read).length;
  $('#notification-count').textContent = unread;
  $('#notification-count').hidden = unread === 0;
  const items = isAdmin
    ? [['overview','Resumen'],['leads','Consultas'],['tasks','Agenda'],['cases','Expedientes'],['finance','Control econÃ³mico'],['notifications','Avisos'],['audit','Registro de actividad']]
    : [['overview','Resumen'],['timeline','CronologÃ­a'],['notifications','Avisos'],['security','Acceso y seguridad']];
  $('#app-nav').innerHTML = items.map(([id,label]) => `<button type="button" data-section="${id}" class="${activeSection===id?'active':''}">${label}</button>`).join('');
  $$('[data-section]').forEach(button => button.addEventListener('click', () => { activeSection=button.dataset.section; renderShell(); $('.sidebar').classList.remove('open'); }));
  renderMain();
}

function renderMain() {
  if (!state.cases.length && state.activeRole !== 'admin') {
    $('#main').innerHTML = `${pageHead('Plataforma privada','TodavÃ­a no hay expedientes asignados','Tu acceso estÃ¡ activo. Cuando se abra el primer expediente aparecerÃ¡ aquÃ­.')}<section class="panel"><div class="empty">No hay expedientes disponibles.</div></section>`;
    return;
  }
  if (state.activeRole === 'admin') renderAdmin(); else renderClient();
}
function pageHead(kicker,title,description,actions='') {
  return `<div class="page-head"><div><p class="kicker">${escapeHtml(kicker)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;
}

function renderClient() {
  const c = currentCase();
  if (activeSection === 'overview') {
    $('#main').innerHTML = `${pageHead(c.reference,c.title,'Consulta el estado real del expediente y cada actuaciÃ³n ya registrada.','<span class="status-pill">'+escapeHtml(c.status)+'</span>')}
      <div class="case-layout"><section class="panel"><div class="panel-head"><h2>Recorrido del expediente</h2><small>Sin fechas estimadas</small></div>${progress(c.stage)}${timeline()}</section><aside>${nextStepCard(c)}${professionalCard(c)}</aside></div>`;
  } else if (activeSection === 'timeline') {
    $('#main').innerHTML = `${pageHead('CronologÃ­a','Cada actuaciÃ³n, en orden','El historial muestra hechos ya registrados. No incluye fechas estimadas de resoluciÃ³n.')}<section class="panel">${timeline(true)}</section>`;
  } else if (activeSection === 'notifications') {
    markNotificationsRead();
    $('#main').innerHTML = `${pageHead('Avisos','Novedades de tu caso','Los avisos te indican cuÃ¡ndo existe un avance o necesitamos una decisiÃ³n.')}<section class="panel"><div class="notification-list">${notificationList()}</div></section>`;
  } else {
    $('#main').innerHTML = `${pageHead('Seguridad','Tu acceso','Controla tu sesiÃ³n y protege el acceso al expediente.')}<div class="case-layout"><section class="panel"><div class="panel-head"><h2>Doble factor de autenticaciÃ³n</h2><span class="status-pill">Recomendado</span></div><p class="panel-copy">AÃ±ade un segundo cÃ³digo ademÃ¡s de tu contraseÃ±a. SerÃ¡ obligatorio para usuarios internos.</p><button class="primary-button" type="button">Configurar doble factor â†’</button></section><section class="panel"><div class="panel-head"><h2>Privacidad del portal</h2></div><p class="panel-copy">Este espacio muestra estados, avances y responsables. No permite adjuntar ni almacenar documentos.</p></section></div>`;
  }
}

function renderAdmin() {
  const c = currentCase();
  const activeCases = state.cases.filter(item => !['closed','archived'].includes(item.statusCode)).length;
  const openLeads = state.leads.filter(item => !['won','lost'].includes(item.status)).length;
  const pendingTasks = state.tasks.filter(item => !item.completed).length;
  const pipelineAmount = state.leads.filter(item => !['lost'].includes(item.status)).reduce((total,item)=>total+Number(item.amount||0),0);
  if (activeSection === 'overview') {
    $('#main').innerHTML = `${pageHead('GestiÃ³n interna','Resumen operativo','Controla desde aquÃ­ cada consulta hasta convertirla en expediente.','<button class="secondary-button" id="new-task">Nueva tarea</button><button class="primary-button" id="new-lead">Registrar consulta <span>â†’</span></button>')}
      <div class="metric-grid"><div class="metric"><small>Consultas abiertas</small><strong>${openLeads}</strong><span>En seguimiento</span></div><div class="metric"><small>Tareas pendientes</small><strong>${pendingTasks}</strong><span>Agenda interna</span></div><div class="metric"><small>Expedientes activos</small><strong>${activeCases}</strong><span>Clientes contratados</span></div><div class="metric"><small>Presupuestado</small><strong>${formatMoney(pipelineAmount)}</strong><span>Sin incluir descartadas</span></div></div>
      <div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Consultas que requieren atenciÃ³n</h2><small>${openLeads} abiertas</small></div>${leadTable(state.leads.filter(item=>!['won','lost'].includes(item.status)).slice(0,6))}</section><section class="panel"><div class="panel-head"><h2>PrÃ³ximas actuaciones</h2><small>Uso interno</small></div>${taskList(state.tasks.filter(iÛßx¶‰žËkºwµçyÐ¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í½Á•¸ ¤íõô¤ì(€ô¤ì)ô)™Õ¹Ñ¥½¸¹½Ñ¥™¥…Ñ¥½¹1¥ÍÐ¡…±°õ™…±Í”¤ì(€½¹ÍÐ±¥ÍÐõ…±°ýÍÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹ÌéÍÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì¹™¥±Ñ•È¡¸ôù¸¹ÕÍ•É%ôôõÕÉÉ•¹ÑUÍ•È ¤¹¥¤ì(€É•ÑÕÉ¸±¥ÍÐ¹±•¹Ñ ý±¥ÍÐ¹µ…À¡¸ôù€ñ…ÉÑ¥±”±…ÍÌô‰¹½Ñ¥”€‘í¸¹É•…üÉ•…œèœôˆøñ¤øð½¤øñ‘¥ØøñÍÑÉ½¹œø‘í•Í…Á•!Ñµ°¡¸¹Ñ¥Ñ±”¥ôð½ÍÑÉ½¹œøñÀø‘í•Í…Á•!Ñµ°¡¸¹‰½‘ä¥ôð½Àøð½‘¥ØøñÑ¥µ”ø‘í™½Éµ…Ñ…Ñ”¡¸¹…Ð¥ôð½Ñ¥µ”øð½…ÉÑ¥±”ù€¤¹©½¥¸ œœ¤èœñ‘¥Ø±…ÍÌô‰•µÁÑäˆù9¼¡…ä…Ù¥Í½Ì¸ð½‘¥Øøœì)ô)™Õ¹Ñ¥½¸…Õ‘¥ÑQ…‰±” ¤ì(€¥˜ …ÍÑ…Ñ”¹…Õ‘¥Ð¹±•¹Ñ ¥É•ÑÕÉ¸€œñ‘¥Ø±…ÍÌô‰•µÁÑäˆù1…Ì…¥½¹•ÌÉ•…±¥é…‘…Ì•¸•ÍÑ„ÁÉÕ•‰„…Á…É••Ë…¸…Å×´¸ð½‘¥Øøœì(€É•ÑÕÉ¸€ñÑ…‰±”±…ÍÌô‰…Í”µÑ…‰±”ˆøñÑ¡•…øñÑÈøñÑ ù5½µ•¹Ñ¼ð½Ñ øñÑ ù§Í¸ð½Ñ øñÑ ù=‰©•Ñ¼ð½Ñ øñÑ ùUÍÕ…É¥¼ð½Ñ øð½ÑÈøð½Ñ¡•…øñÑ‰½‘äø‘íl¸¸¹ÍÑ…Ñ”¹…Õ‘¥Ñt¹É•Ù•ÉÍ” ¤¹µ…À¡„ôù€ñÑÈøñÑø‘í™½Éµ…Ñ…Ñ”¡„¹…Ð¥ôð½ÑøñÑø‘í•Í…Á•!Ñµ°¡„¹…Ñ¥½¸¥ôð½ÑøñÑø‘í•Í…Á•!Ñµ°¡„¹½‰©•ÑQåÁ”¥ôƒ
Ü€‘í•Í…Á•!Ñµ°¡MÑÉ¥¹œ¡„¹½‰©•Ñ%¤¹Í±¥” À°ÄÈ¤¥ôð½ÑøñÑø‘í•Í…Á•!Ñµ°¡„¹…Ñ½É%¥ôð½Ñøð½ÑÈù€¤¹©½¥¸ œœ¥ôð½Ñ‰½‘äøð½Ñ…‰±”ù€ì)ô()™Õ¹Ñ¥½¸‰¥¹‘ÉµÑ¥½¹Ì ¤ì(€€ œ¹•Üµ±•…œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôø œ±•…µ‘¥…±½œœ¤¹Í¡½Ý5½‘…° ¤¤ì(€€ œ¹•ÜµÑ…Í¬œ¤ü¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±½Á•¹Q…Í­¥…±½œ¤ì(€€ m‘…Ñ„µ±•…µ¥‘tœ¤¹™½É… ¡¹½‘”ôùì(€€€½¹ÍÐ½Á•¸ô ¤ôù½Á•¹1•…‘¥…±½œ¡¹½‘”¹‘…Ñ…Í•Ð¹±•…‘%¤ì(€€€¹½‘”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±½Á•¸¤ì(€€€¹½‘”¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ­•å‘½Ý¸œ±•Ù•¹Ðôùí¥˜¡•Ù•¹Ð¹­•äôôô¹Ñ•Èññ•Ù•¹Ð¹­•äôôôœ€œ¥í•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í½Á•¸ ¤íõô¤ì(€ô¤ì(€€ m‘…Ñ„µÑ…Í¬µ¥‘tœ¤¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùÑ½±•Q…Í¬¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹Ñ…Í­%¤¤¤ì)ô)™Õ¹Ñ¥½¸½Á•¹1•…‘¥…±½œ¡±•…‘%¤ì(€½¹ÍÐ±•…õÍÑ…Ñ”¹±•…‘Ì¹™¥¹¡¥Ñ•´ôù¥Ñ•´¹¥ôôõ±•…‘%¤ì¥˜ …±•…¥É•ÑÕÉ¸ì(€€ œ±•…µ‘•Ñ…¥°µ¥œ¤¹Ù…±Õ”õ±•…¹¥ì(€€ œ±•…µ‘•Ñ…¥°µÑ¥Ñ±”œ¤¹Ñ•áÑ½¹Ñ•¹Ðõ€‘í±•…¹É•™•É•¹•ôƒ
Ü€‘í±•…¹¹…µ•õ€ì(€€ œ±•…µ‘•Ñ…¥°µ½¹Ñ…Ðœ¤¹¥¹¹•É!Q50õ€ñ‘¥ØøñÍµ…±°ù½¹Ñ…Ñ¼ð½Íµ…±°øñÍÑÉ½¹œø‘í•Í…Á•!Ñµ°¡±•…¹Á¡½¹”¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í•Í…Á•!Ñµ°¡±•…¹•µ…¥°¥ôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñÍµ…±°ù½¹ÍÕ±Ñ„ð½Íµ…±°øñÍÑÉ½¹œø‘í•Í…Á•!Ñµ°¡±•…¹…Ñ•½Éä¥ôð½ÍÑÉ½¹œøñÍÁ…¸ø‘í•Í…Á•!Ñµ°¡±•…¹ÍÕµµ…Éä¥ôð½ÍÁ…¸øð½‘¥Øøñ‘¥ØøñÍµ…±°ùAÉ¥Ù…¥‘…ð½Íµ…±°øñÍÑÉ½¹œù½¹Í•¹Ñ¥µ¥•¹Ñ¼É•¥ÍÑÉ…‘¼ð½ÍÑÉ½¹œøñÍÁ…¸ø‘í•Í…Á•!Ñµ°¡™½Éµ…Ñ…Ñ”¡±•…¹½¹Í•¹ÑÐ¤¥ôð½ÍÁ…¸øð½‘¥Øù€ì(€€ œ±•…µ‘•Ñ…¥°µÍÑ…ÑÕÌœ¤¹Ù…±Õ”õ±•…¹ÍÑ…ÑÕÌì(€€ œ±•…µ‘•Ñ…¥°µ¹•áÐµ…Ñ¥½¸œ¤¹Ù…±Õ”õ±•…¹¹•áÑÑ¥½¹ñðœœì(€€ œ±•…µ‘•Ñ…¥°µ™½±±½ÜµÕÀœ¤¹Ù…±Õ”õMÑÉ¥¹œ¡±•…¹™½±±½ÝUÁñðœœ¤¹Í±¥” À°ÄÀ¤ì(€€ œ±•…µ‘•Ñ…¥°µ…µ½Õ¹Ðœ¤¹Ù…±Õ”õ±•…¹…µ½Õ¹Ññðœœì(€€ œ±•…µ‘•Ñ…¥°µ¹½Ñ”œ¤¹Ù…±Õ”ôœœì(€€ œ½¹Ù•ÉÐµ±•…œ¤¹‘¥Í…‰±•õ±•…¹ÍÑ…ÑÕÌôôôÝ½¸œì(€€ œ±•…µ‘•Ñ…¥°µ‘¥…±½œœ¤¹Í¡½Ý5½‘…° ¤ì)ô)™Õ¹Ñ¥½¸½Á•¹Q…Í­¥…±½œ ¤ì(€€ œÑ…Í¬µ±•…œ¤¹¥¹¹•É!Q50õÍÑ…Ñ”¹±•…‘Ì¹™¥±Ñ•È¡¥Ñ•´ôø…lÝ½¸œ°±½ÍÐt¹¥¹±Õ‘•Ì¡¥Ñ•´¹ÍÑ…ÑÕÌ¤¤¹µ…À¡¥Ñ•´ôù€ñ½ÁÑ¥½¸Ù…±Õ”ôˆ‘í•Í…Á•!Ñµ°¡¥Ñ•´¹¥¥ôˆø‘í•Í…Á•!Ñµ°¡¥Ñ•´¹É•™•É•¹”¬œƒ
Ü€œ­¥Ñ•´¹¹…µ”¥ôð½½ÁÑ¥½¸ù€¤¹©½¥¸ œœ¤ì(€€ œÑ…Í¬µ‘…Ñ”œ¤¹Ù…±Õ”õ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°ÄÀ¤ì(€€ œÑ…Í¬µ‘¥…±½œœ¤¹Í¡½Ý5½‘…° ¤ì)ô)…Íå¹Œ™Õ¹Ñ¥½¸Ñ½±•Q…Í¬¡Ñ…Í­%¤ì(€½¹ÍÐÑ…Í¬õÍÑ…Ñ”¹Ñ…Í­Ì¹™¥¹¡¥Ñ•´ôù¥Ñ•´¹¥ôôõÑ…Í­%¤ì¥˜ …Ñ…Í¬¥É•ÑÕÉ¸ì(€Ñ…Í¬¹½µÁ±•Ñ•ô…Ñ…Í¬¹½µÁ±•Ñ•ì(€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥ì(€€€ÑÉåí…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹ÕÁ‘…Ñ” Éµ}Ñ…Í­Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡Ñ…Í¬¹¥¥õ€±í½µÁ±•Ñ•‘}…ÐéÑ…Í¬¹½µÁ±•Ñ•ý¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤é¹Õ±±ô¤íô(€€€…Ñ¡íÑ…Í¬¹½µÁ±•Ñ•ô…Ñ…Í¬¹½µÁ±•Ñ•íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼…ÑÕ…±¥é…È±„Ñ…É•„¸œ¤íÉ•ÑÕÉ¸íô(€ô•±Í”ì±½œ¡Ñ…Í¬¹½µÁ±•Ñ•üÑ…Í­}½µÁ±•Ñ•œèÑ…Í­}É•½Á•¹•œ°Éµ}Ñ…Í¬œ±Ñ…Í¬¹¥¤íÍ…Ù•MÑ…Ñ” ¤ìô(€É•¹‘•ÉM¡•±° ¤ì)ô)™Õ¹Ñ¥½¸¹•áÑ1•…‘I•™•É•¹” ¤ì(€½¹ÍÐå•…Èõ¹•Ü…Ñ” ¤¹•ÑÕ±±e•…È ¤ì(€½¹ÍÐµ…á¥µÕ´õÍÑ…Ñ”¹±•…‘Ì¹É•‘Õ” ¡µ…à±¥Ñ•´¤ôù5…Ñ ¹µ…à¡µ…à±9Õµ‰•È¡MÑÉ¥¹œ¡¥Ñ•´¹É•™•É•¹•ñðœœ¤¹ÍÁ±¥Ð œ´œ¤¹Á½À ¤¥ñðÀ¤°À¤ì(€É•ÑÕÉ¸´‘íå•…Éô´‘íMÑÉ¥¹œ¡µ…á¥µÕ´¬Ä¤¹Á…‘MÑ…ÉÐ Ì°œÀœ¥õ€ì)ô()™Õ¹Ñ¥½¸½Á•¹UÁ‘…Ñ•¥…±½œ ¤ì(€½¹ÍÐŒõÕÉÉ•¹Ñ…Í” ¤ì(€€ œÕÁ‘…Ñ”µÍÑ…ÑÕÌœ¤¹Ù…±Õ”õŒ¹ÍÑ…ÑÕÍ½‘”ì(€€ œÕÁ‘…Ñ”µÑ¥Ñ±”œ¤¹Ù…±Õ”ôœœì(€€ œÕÁ‘…Ñ”µ‘•ÍÉ¥ÁÑ¥½¸œ¤¹Ù…±Õ”ôœœì(€€ œÕÁ‘…Ñ”µ¹•áÐµÍÑ•Àœ¤¹Ù…±Õ”õŒ¹±¥•¹Ñ9•áÑMÑ•Àñð€œœì(€€ œÁÉ½™•ÍÍ¥½¹…°µ¹…µ”œ¤¹Ù…±Õ”õŒ¹ÁÉ½™•ÍÍ¥½¹…±9…µ”ñð€œœì(€€ œÁÉ½™•ÍÍ¥½¹…°µÑ¥Ñ±”œ¤¹Ù…±Õ”õŒ¹ÁÉ½™•ÍÍ¥½¹…±Q¥Ñ±”ñð€œœì(€€ œÁÉ½™•ÍÍ¥½¹…°µÉ•¥ÍÑÉ…Ñ¥½¸œ¤¹Ù…±Õ”õŒ¹ÁÉ½™•ÍÍ¥½¹…±I•¥ÍÑÉ…Ñ¥½¸ñð€œœì(€€ œÁÉ½™•ÍÍ¥½¹…°µÉ•¥½¸œ¤¹Ù…±Õ”õŒ¹ÁÉ½™•ÍÍ¥½¹…±I•¥½¸ñð€œœì(€€ œÕÁ‘…Ñ”µ‘¥…±½œœ¤¹Í¡½Ý5½‘…° ¤ì)ô)™Õ¹Ñ¥½¸µ…É­9½Ñ¥™¥…Ñ¥½¹ÍI•… ¤ì(€½¹ÍÐÕ¹É•…õÍÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì¹™¥±Ñ•È¡¸ôù¸¹ÕÍ•É%ôôõÕÉÉ•¹ÑUÍ•È ¤¹¥˜˜…¸¹É•…¤ì(€Õ¹É•…¹™½É… ¡¸ôù¸¹É•…õÑÉÕ”¤ì(€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥Õ¹É•…¹™½É… ¡¸ôùÁ±…Ñ™½ÉµÁ¤¹ÕÁ‘…Ñ” ¹½Ñ¥™¥…Ñ¥½¹Ìœ±¥õ•Ä¸‘í•¹½‘•UI%½µÁ½¹•¹Ð¡¸¹¥¥õ€±íÉ•…‘}…Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤¹…Ñ   ¤ôùíô¤¤ì(€•±Í”Í…Ù•MÑ…Ñ” ¤ì)ô)™Õ¹Ñ¥½¸Ñ½…ÍÐ¡µ•ÍÍ…”¤ì(€½¹ÍÐ¹½‘”ô œÑ½…ÍÐœ¤í¹½‘”¹Ñ•áÑ½¹Ñ•¹Ðõµ•ÍÍ…”í¹½‘”¹¡¥‘‘•¸õ™…±Í”í±•…ÉQ¥µ•½ÕÐ¡Ñ½…ÍÐ¹Ñ¥µ•È¤íÑ½…ÍÐ¹Ñ¥µ•ÈõÍ•ÑQ¥µ•½ÕÐ  ¤ôù¹½‘”¹¡¥‘‘•¸õÑÉÕ”°ÌÈÀÀ¤ì)ô(( m‘…Ñ„µ‘•µ¼µÉ½±•tœ¤¹™½É… ¡‰ÕÑÑ½¸ôù‰ÕÑÑ½¸¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôù•¹Ñ•È¡‰ÕÑÑ½¸¹‘…Ñ…Í•Ð¹‘•µ½I½±”¤¤¤ì( œ±½¥¸µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤ì(€¥˜ …ÁÉ½‘ÕÑ¥½¹5½‘”¥í•¹Ñ•È ±¥•¹Ðœ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐ‰ÕÑÑ½¸õ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èí‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåí½¹ÍÐ‘…Ñ„õ¹•Ü½Éµ…Ñ„¡•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¤í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹Í¥¹%¸¡‘…Ñ„¹•Ð •µ…¥°œ¤±‘…Ñ„¹•Ð Á…ÍÍÝ½Éœ¤¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€…Ñ ¡•ÉÉ½È¥íÑ½…ÍÐ¡•ÉÉ½Èü¹ÍÑ…ÑÕÌôôôÐÀÀü½ÉÉ•¼¼½¹ÑÉ…Í—Å„¥¹½ÉÉ•Ñ½Ì¸œè9¼Í”¡„Á½‘¥‘¼¥¹¥¥…ÈÍ•Í§Í¸‘”™½Éµ„Í•ÕÉ„¸œ¤íô(€™¥¹…±±åí‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ±½½ÕÐœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±±½½ÕÐ¤ì( œÉ•½Ù•Èµ…•ÍÌœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ ¤ôùì(€½¹ÍÐ•µ…¥°ô œ±½¥¸µ™½É´¥¹ÁÕÑm¹…µ”ô‰•µ…¥°‰tœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤ì(€¥˜ …ÁÉ½‘ÕÑ¥½¹5½‘”¥íÑ½…ÍÐ ¸ÁÉ½‘Õ§Í¸É•¥‰¥Ë…ÌÕ¸•¹±…”Í•ÕÉ¼Á…É„É•ÕÁ•É…È•°…•Í¼¸œ¤íÉ•ÑÕÉ¸íô(€¥˜ …•µ…¥°¥íÑ½…ÍÐ ÍÉ¥‰”ÁÉ¥µ•É¼ÑÔ½ÉÉ•¼•±•ÑËÍ¹¥¼¸œ¤íÉ•ÑÕÉ¸íô(€ÑÉåí…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹É•ÅÕ•ÍÑA…ÍÍÝ½É‘I•Í•Ð¡•µ…¥°±€‘í±½…Ñ¥½¸¹½É¥¥¹ô½É•ÍÑ…‰±••É€¤íÑ½…ÍÐ M¤•°½ÉÉ•¼•ÍÓ„É•¥ÍÑÉ…‘¼°É•¥‰¥Ë…ÌÕ¸•¹±…”‘”É•ÕÁ•É…§Í¸¸œ¤íô(€…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼Í½±¥¥Ñ…È±„É•ÕÁ•É…§Í¸¸%¹Ó¥¹Ñ…±¼‘”¹Õ•Ù¼¸œ¤íô)ô¤ì( œµ½‰¥±”µµ•¹Ôœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôø œ¹Í¥‘•‰…Èœ¤¹±…ÍÍ1¥ÍÐ¹Ñ½±” ½Á•¸œ¤¤ì( œÕÁ‘…Ñ”µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í¥˜¡•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èü¹Ù…±Õ”ôôô…¹•°œ¥ì œÕÁ‘…Ñ”µ‘¥…±½œœ¤¹±½Í” ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÁ…å±½…õì(€€€…Í•%éÕÉÉ•¹Ñ…Í” ¤¹¥±ÍÑ…ÑÕÌè œÕÁ‘…Ñ”µÍÑ…ÑÕÌœ¤¹Ù…±Õ”±Ñ¥Ñ±”è œÕÁ‘…Ñ”µÑ¥Ñ±”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±‘•ÍÉ¥ÁÑ¥½¸è œÕÁ‘…Ñ”µ‘•ÍÉ¥ÁÑ¥½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°(€€€±¥•¹Ñ9•áÑMÑ•Àè œÕÁ‘…Ñ”µ¹•áÐµÍÑ•Àœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±ÁÉ½™•ÍÍ¥½¹…±9…µ”è œÁÉ½™•ÍÍ¥½¹…°µ¹…µ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±ÁÉ½™•ÍÍ¥½¹…±Q¥Ñ±”è œÁÉ½™•ÍÍ¥½¹…°µÑ¥Ñ±”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°(€€€ÁÉ½™•ÍÍ¥½¹…±I•¥ÍÑÉ…Ñ¥½¸è œÁÉ½™•ÍÍ¥½¹…°µÉ•¥ÍÑÉ…Ñ¥½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±ÁÉ½™•ÍÍ¥½¹…±I•¥½¸è œÁÉ½™•ÍÍ¥½¹…°µÉ•¥½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤(€ôì(€¥˜ …Á…å±½…¹Ñ¥Ñ±•ñð…Á…å±½…¹‘•ÍÉ¥ÁÑ¥½¸¥É•ÑÕÉ¸ì(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåì(€€€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” ÕÁ‘…Ñ”µ…Í”œ±Á…å±½…¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€€€•±Í•ì(€€€€€½¹ÍÐŒõÕÉÉ•¹Ñ…Í” ¤í=‰©•Ð¹…ÍÍ¥¸¡Œ±íÍÑ…ÑÕÍ½‘”éÁ…å±½…¹ÍÑ…ÑÕÌ±ÍÑ…ÑÕÌéÍÑ…ÑÕÍ1…‰•±ÍmÁ…å±½…¹ÍÑ…ÑÕÍt±ÍÑ…”éÍÑ…ÑÕÍMÑ…•ÍmÁ…å±½…¹ÍÑ…ÑÕÍt±±¥•¹Ñ9•áÑMÑ•ÀéÁ…å±½…¹±¥•¹Ñ9•áÑMÑ•À±ÁÉ½™•ÍÍ¥½¹…±9…µ”éÁ…å±½…¹ÁÉ½™•ÍÍ¥½¹…±9…µ”±ÁÉ½™•ÍÍ¥½¹…±Q¥Ñ±”éÁ…å±½…¹ÁÉ½™•ÍÍ¥½¹…±Q¥Ñ±”±ÁÉ½™•ÍÍ¥½¹…±I•¥ÍÑÉ…Ñ¥½¸éÁ…å±½…¹ÁÉ½™•ÍÍ¥½¹…±I•¥ÍÑÉ…Ñ¥½¸±ÁÉ½™•ÍÍ¥½¹…±I•¥½¸éÁ…å±½…¹ÁÉ½™•ÍÍ¥½¹…±I•¥½¹ô¤ì(€€€€€½¹ÍÐ…Ðõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤íÍÑ…Ñ”¹•Ù•¹ÑÌ¹™½É… ¡¥Ñ•´ôù¥Ñ•´¹ÕÉÉ•¹Ðõ™…±Í”¤íÍÑ…Ñ”¹•Ù•¹ÑÌ¹ÁÕÍ ¡í¥éÉåÁÑ¼¹É…¹‘½µUU% ¤±…Í•%éŒ¹¥±­¥¹éÁ…å±½…¹ÍÑ…ÑÕÌ±Ñ¥Ñ±”éÁ…å±½…¹Ñ¥Ñ±”±‘•ÍÉ¥ÁÑ¥½¸éÁ…å±½…¹‘•ÍÉ¥ÁÑ¥½¸±…Ð±ÕÉÉ•¹ÐéÑÉÕ•ô¤ì(€€€€€ÍÑ…Ñ”¹¹½Ñ¥™¥…Ñ¥½¹Ì¹ÁÕÍ ¡í¥éÉåÁÑ¼¹É…¹‘½µUU% ¤±ÕÍ•É%éÍÑ…Ñ”¹ÕÍ•ÉÌ¹±¥•¹Ð¹¥±…Í•%éŒ¹¥±Ñ¥Ñ±”è9Õ•Ù¼…Ù…¹”•¸ÑÔ•áÁ•‘¥•¹Ñ”œ±‰½‘äéÁ…å±½…¹Ñ¥Ñ±”±…Ð±É•…é™…±Í•ô¤ì(€€€€€±½œ …Í•}ÕÁ‘…Ñ•œ°…Í”œ±Œ¹¥±íÍÑ…ÑÕÌéÁ…å±½…¹ÍÑ…ÑÕÍô¤íÍ…Ù•MÑ…Ñ” ¤íÉ•¹‘•ÉM¡•±° ¤ì(€€€ô(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹É•Í•Ð ¤ì œÕÁ‘…Ñ”µ‘¥…±½œœ¤¹±½Í” ¤íÑ½…ÍÐ Ù…¹”Õ…É‘…‘¼ä…Ù¥Í¼É•¥ÍÑÉ…‘¼¸œ¤ì(€õ…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼Õ…É‘…È•°…Ù…¹”¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ¥¹Ù¥Ñ”µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í¥˜¡•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èü¹Ù…±Õ”ôôô…¹•°œ¥ì œ¥¹Ù¥Ñ”µ‘¥…±½œœ¤¹±½Í” ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÁ…å±½…õí•µ…¥°è œ¥¹Ù¥Ñ”µ•µ…¥°œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±‘¥ÍÁ±…å9…µ”è œ¥¹Ù¥Ñ”µ¹…µ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Ñ¥Ñ±”è œ¥¹Ù¥Ñ”µÑ¥Ñ±”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±…Ñ•½Éäè œ¥¹Ù¥Ñ”µ…Ñ•½Éäœ¤¹Ù…±Õ•ôì(€¥˜ …ÁÉ½‘ÕÑ¥½¹5½‘•ñð…Á±…Ñ™½ÉµÁ¤¥íÑ½…ÍÐ °…±Ñ„É•…°Í”¡…‰¥±¥Ñ…Ë„…°½¹•Ñ…È•°Í•ÉÙ¥‘½È•ÕÉ½Á•¼¸œ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåí½¹ÍÐÉ•…Ñ•õ…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” ¥¹Ù¥Ñ”µ±¥•¹Ðœ±Á…å±½…¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤í…Ñ¥Ù•…Í•%õÉ•…Ñ•¹…Í•%í…Ñ¥Ù•M•Ñ¥½¸ô…Í•ÌœíÉ•¹‘•ÉM¡•±° ¤í•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹É•Í•Ð ¤ì œ¥¹Ù¥Ñ”µ‘¥…±½œœ¤¹±½Í” ¤íÑ½…ÍÐ áÁ•‘¥•¹Ñ”É•…‘¼”¥¹Ù¥Ñ…§Í¸•¹Ù¥…‘„¸œ¤íô(€…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼½µÁ±•Ñ…È•°…±Ñ„¸I•Ù¥Í„•°½ÉÉ•¼äÙÕ•±Ù”„¥¹Ñ•¹Ñ…É±¼¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ±•…µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í¥˜¡•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èü¹Ù…±Õ”ôôô…¹•°œ¥ì œ±•…µ‘¥…±½œœ¤¹±½Í” ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÁ…å±½…õì(€€€™Õ±±9…µ”è œ±•…µ¹…µ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±Á¡½¹”è œ±•…µÁ¡½¹”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±•µ…¥°è œ±•…µ•µ…¥°œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤¹Ñ½1½Ý•É…Í” ¤±ÁÉ½Ù¥¹”è œ±•…µÁÉ½Ù¥¹”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤°(€€€…Ñ•½Éäè œ±•…µ…Ñ•½Éäœ¤¹Ù…±Õ”±Í½ÕÉ”è œ±•…µÍ½ÕÉ”œ¤¹Ù…±Õ”±ÍÕµµ…Éäè œ±•…µÍÕµµ…Éäœ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±½¹Í•¹Ðé	½½±•…¸  œ±•…µ½¹Í•¹Ðœ¤¹¡•­•¤(€ôì(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåì(€€€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” µ…¹…”µÉ´œ±í…Ñ¥½¸èÉ•…Ñ•}±•…œ°¸¸¹Á…å±½…‘ô¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€€€•±Í•ì(€€€€€½¹ÍÐ…Ðõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤í½¹ÍÐ¥õÉåÁÑ¼¹É…¹‘½µUU% ¤ì(€€€€€ÍÑ…Ñ”¹±•…‘Ì¹Õ¹Í¡¥™Ð¡í¥±É•™•É•¹”é¹•áÑ1•…‘I•™•É•¹” ¤±¹…µ”éÁ…å±½…¹™Õ±±9…µ”±Á¡½¹”éÁ…å±½…¹Á¡½¹”±•µ…¥°éÁ…å±½…¹•µ…¥°±ÁÉ½Ù¥¹”éÁ…å±½…¹ÁÉ½Ù¥¹”±…Ñ•½ÉäéÁ…å±½…¹…Ñ•½Éä±Í½ÕÉ”éÁ…å±½…¹Í½ÕÉ”±ÍÕµµ…ÉäéÁ…å±½…¹ÍÕµµ…Éä±ÍÑ…ÑÕÌè¹•Üœ±¹•áÑÑ¥½¸èI•…±¥é…ÈÁÉ¥µ•È½¹Ñ…Ñ¼œ±™½±±½ÝUÀèœœ±…µ½Õ¹ÐèÀ±½¹Í•¹ÑÐé…Ð±É•…Ñ•‘Ðé…Ð±ÕÁ‘…Ñ•‘Ðé…Ð±¹½Ñ•Ìémuô¤ì(€€€€€±½œ ±•…‘}É•…Ñ•œ°Éµ}±•…œ±¥±íÍ½ÕÉ”éÁ…å±½…¹Í½ÕÉ•ô¤íÍ…Ù•MÑ…Ñ” ¤ì(€€€ô(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹É•Í•Ð ¤ì œ±•…µ‘¥…±½œœ¤¹±½Í” ¤í…Ñ¥Ù•M•Ñ¥½¸ô±•…‘ÌœíÉ•¹‘•ÉM¡•±° ¤íÑ½…ÍÐ ½¹ÍÕ±Ñ„É•¥ÍÑÉ…‘„½ÉÉ•Ñ…µ•¹Ñ”¸œ¤ì(€õ…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼É•¥ÍÑÉ…È±„½¹ÍÕ±Ñ„¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ±•…µ‘•Ñ…¥°µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í¥˜¡•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èü¹Ù…±Õ”ôôô…¹•°œ¥ì œ±•…µ‘•Ñ…¥°µ‘¥…±½œœ¤¹±½Í” ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐ±•…õÍÑ…Ñ”¹±•…‘Ì¹™¥¹¡¥Ñ•´ôù¥Ñ•´¹¥ôôô œ±•…µ‘•Ñ…¥°µ¥œ¤¹Ù…±Õ”¤í¥˜ …±•…¥É•ÑÕÉ¸ì(€½¹ÍÐ¡…¹•ÌõíÍÑ…ÑÕÌè œ±•…µ‘•Ñ…¥°µÍÑ…ÑÕÌœ¤¹Ù…±Õ”±¹•áÑÑ¥½¸è œ±•…µ‘•Ñ…¥°µ¹•áÐµ…Ñ¥½¸œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±™½±±½ÝUÀè œ±•…µ‘•Ñ…¥°µ™½±±½ÜµÕÀœ¤¹Ù…±Õ”±…µ½Õ¹Ðé9Õµ‰•È  œ±•…µ‘•Ñ…¥°µ…µ½Õ¹Ðœ¤¹Ù…±Õ•ñðÀ¤±¹½Ñ”è œ±•…µ‘•Ñ…¥°µ¹½Ñ”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¥ôì(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåì(€€€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” µ…¹…”µÉ´œ±í…Ñ¥½¸èÕÁ‘…Ñ•}±•…œ±±•…‘%é±•…¹¥°¸¸¹¡…¹•Íô¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€€€•±Í•ì(€€€€€=‰©•Ð¹…ÍÍ¥¸¡±•…±íÍÑ…ÑÕÌé¡…¹•Ì¹ÍÑ…ÑÕÌ±¹•áÑÑ¥½¸é¡…¹•Ì¹¹•áÑÑ¥½¸±™½±±½ÝUÀé¡…¹•Ì¹™½±±½ÝUÀ±…µ½Õ¹Ðé¡…¹•Ì¹…µ½Õ¹Ð±ÕÁ‘…Ñ•‘Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤ì(€€€€€¥˜¡¡…¹•Ì¹¹½Ñ”¥±•…¹¹½Ñ•Ì¹ÁÕÍ ¡í¥éÉåÁÑ¼¹É…¹‘½µUU% ¤±‰½‘äé¡…¹•Ì¹¹½Ñ”±…Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤ì(€€€€€±½œ ±•…‘}ÕÁ‘…Ñ•œ°Éµ}±•…œ±±•…¹¥±íÍÑ…ÑÕÌé¡…¹•Ì¹ÍÑ…ÑÕÍô¤íÍ…Ù•MÑ…Ñ” ¤ì(€€€ô(€€€€ œ±•…µ‘•Ñ…¥°µ‘¥…±½œœ¤¹±½Í” ¤íÉ•¹‘•ÉM¡•±° ¤íÑ½…ÍÐ ½¹ÍÕ±Ñ„…ÑÕ…±¥é…‘„¸œ¤ì(€õ…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼…ÑÕ…±¥é…È±„½¹ÍÕ±Ñ„¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ½¹Ù•ÉÐµ±•…œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±…Íå¹Œ ¤ôùì(€½¹ÍÐ±•…õÍÑ…Ñ”¹±•…‘Ì¹™¥¹¡¥Ñ•´ôù¥Ñ•´¹¥ôôô œ±•…µ‘•Ñ…¥°µ¥œ¤¹Ù…±Õ”¤í¥˜ …±•…¥É•ÑÕÉ¸ì(€½¹ÍÐ‰ÕÑÑ½¸ô œ½¹Ù•ÉÐµ±•…œ¤í‰ÕÑÑ½¸¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåì(€€€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” µ…¹…”µÉ´œ±í…Ñ¥½¸è½¹Ù•ÉÑ}±•…œ±±•…‘%é±•…¹¥‘ô¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€€€•±Í•ì(€€€€€½¹ÍÐ…Í•%õÉåÁÑ¼¹É…¹‘½µUU% ¤ì(€€€€€½¹ÍÐ±¥•¹Ñ%õ±•…µ±¥•¹Ð´‘í±•…¹¥‘õ€ì(€€€€€ÍÑ…Ñ”¹…Í•Ì¹Õ¹Í¡¥™Ð¡í¥é…Í•%±É•™•É•¹”éIL´‘í¹•Ü…Ñ” ¤¹•ÑÕ±±e•…È ¥ô´‘íMÑÉ¥¹œ¡ÍÑ…Ñ”¹…Í•Ì¹±•¹Ñ ¬Ä¤¹Á…‘MÑ…ÉÐ Ð°œÀœ¥õ€±±¥•¹Ñ%±±¥•¹Ðé±•…¹¹…µ”±Ñ¥Ñ±”é±•…¹ÍÕµµ…Éä¹Í±¥” À°ÄÀÀ¤±…Ñ•½Éäé±•…¹…Ñ•½Éä±ÍÑ…ÑÕÍ½‘”è½Á•¸œ±ÍÑ…ÑÕÌè‰¥•ÉÑ¼œ±ÍÑ…”èÀ±½Á•¹•‘Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤±±¥•¹Ñ9•áÑMÑ•Àèœœ±ÁÉ½™•ÍÍ¥½¹…±9…µ”èœœ±ÁÉ½™•ÍÍ¥½¹…±Q¥Ñ±”èœœ±ÁÉ½™•ÍÍ¥½¹…±I•¥ÍÑÉ…Ñ¥½¸èœœ±ÁÉ½™•ÍÍ¥½¹…±I•¥½¸é±•…¹ÁÉ½Ù¥¹•ô¤ì(€€€€€ÍÑ…Ñ”¹•Ù•¹ÑÌ¹ÁÕÍ ¡í¥éÉåÁÑ¼¹É…¹‘½µUU% ¤±…Í•%±­¥¹è½Á•¸œ±Ñ¥Ñ±”èáÁ•‘¥•¹Ñ”…‰¥•ÉÑ¼œ±‘•ÍÉ¥ÁÑ¥½¸è1„½¹ÍÕ±Ñ„¡„Í¥‘¼…•ÁÑ…‘„ä½¹Ù•ÉÑ¥‘„•¸•áÁ•‘¥•¹Ñ”¸œ±…Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤±ÕÉÉ•¹ÐéÑÉÕ•ô¤ì(€€€€€±•…¹ÍÑ…ÑÕÌôÝ½¸œí±•…¹ÕÁ‘…Ñ•‘Ðõ¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤í…Ñ¥Ù•…Í•%õ…Í•%ì(€€€€€±½œ ±•…‘}½¹Ù•ÉÑ•œ°Éµ}±•…œ±±•…¹¥±í…Í•%‘ô¤íÍ…Ù•MÑ…Ñ” ¤ì(€€€ô(€€€€ œ±•…µ‘•Ñ…¥°µ‘¥…±½œœ¤¹±½Í” ¤í…Ñ¥Ù•M•Ñ¥½¸ô…Í•ÌœíÉ•¹‘•ÉM¡•±° ¤íÑ½…ÍÐ ½¹ÍÕ±Ñ„½¹Ù•ÉÑ¥‘„•¸•áÁ•‘¥•¹Ñ”¸œ¤ì(€õ…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼½¹Ù•ÉÑ¥È±„½¹ÍÕ±Ñ„¸œ¤íô(€™¥¹…±±åí‰ÕÑÑ½¸¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œÑ…Í¬µ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í¥˜¡•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•Èü¹Ù…±Õ”ôôô…¹•°œ¥ì œÑ…Í¬µ‘¥…±½œœ¤¹±½Í” ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÁ…å±½…õíÑ¥Ñ±”è œÑ…Í¬µÑ¥Ñ±”œ¤¹Ù…±Õ”¹ÑÉ¥´ ¤±‘Õ•…Ñ”è œÑ…Í¬µ‘…Ñ”œ¤¹Ù…±Õ”±ÁÉ¥½É¥Ñäè œÑ…Í¬µÁÉ¥½É¥Ñäœ¤¹Ù…±Õ”±±•…‘%è œÑ…Í¬µ±•…œ¤¹Ù…±Õ•ôì(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåì(€€€¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”˜™Á±…Ñ™½ÉµÁ¤¥í…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹¥¹Ù½­” µ…¹…”µÉ´œ±í…Ñ¥½¸èÉ•…Ñ•}Ñ…Í¬œ°¸¸¹Á…å±½…‘ô¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íô(€€€•±Í•í½¹ÍÐ¥õÉåÁÑ¼¹É…¹‘½µUU% ¤íÍÑ…Ñ”¹Ñ…Í­Ì¹ÁÕÍ ¡í¥°¸¸¹Á…å±½…±½µÁ±•Ñ•é™…±Í”±É•…Ñ•‘Ðé¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¥ô¤í±½œ Ñ…Í­}É•…Ñ•œ°Éµ}Ñ…Í¬œ±¥¤íÍ…Ù•MÑ…Ñ” ¤íô(€€€•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹É•Í•Ð ¤ì œÑ…Í¬µ‘¥…±½œœ¤¹±½Í” ¤í…Ñ¥Ù•M•Ñ¥½¸ôÑ…Í­ÌœíÉ•¹‘•ÉM¡•±° ¤íÑ½…ÍÐ Q…É•„É•¥ÍÑÉ…‘„¸œ¤ì(€õ…Ñ¡íÑ½…ÍÐ 9¼Í”¡„Á½‘¥‘¼É•¥ÍÑÉ…È±„Ñ…É•„¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œÁ…ÍÍÝ½Éµ™½É´œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ÍÕ‰µ¥Ðœ±…Íå¹Œ•Ù•¹Ðôùì(€•Ù•¹Ð¹ÁÉ•Ù•¹Ñ•™…Õ±Ð ¤í½¹ÍÐÁ…ÍÍÝ½Éô œ¹•ÜµÁ…ÍÍÝ½Éœ¤¹Ù…±Õ”±½¹™¥Éµ…Ñ¥½¸ô œ½¹™¥É´µÁ…ÍÍÝ½Éœ¤¹Ù…±Õ”ì(€¥˜¡Á…ÍÍÝ½É„ôõ½¹™¥Éµ…Ñ¥½¸¥íÑ½…ÍÐ 1…Ì½¹ÑÉ…Í—Å…Ì¹¼½¥¹¥‘•¸¸œ¤íÉ•ÑÕÉ¸íô(€½¹ÍÐÍÕ‰µ¥ÑÑ•Èõ•Ù•¹Ð¹ÍÕ‰µ¥ÑÑ•ÈíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õÑÉÕ”ì(€ÑÉåí…Ý…¥ÐÁ±…Ñ™½ÉµÁ¤¹ÕÁ‘…Ñ•A…ÍÍÝ½É¡Á…ÍÍÝ½É¤í•Ù•¹Ð¹ÕÉÉ•¹ÑQ…É•Ð¹É•Í•Ð ¤ì œÁ…ÍÍÝ½Éµ‘¥…±½œœ¤¹±½Í” ¤í…Ý…¥Ð•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤íÑ½…ÍÐ •Í¼½¹™¥Éµ…‘¼½ÉÉ•Ñ…µ•¹Ñ”¸œ¤íô(€…Ñ ¡•ÉÉ½È¥íÑ½…ÍÐ¡•ÉÉ½Èü¹½‘”ôôô]-}AMM]=Iœü1„½¹ÑÉ…Í—Å„‘•‰”Ñ•¹•È…°µ•¹½Ì€ÄÈ…É…Ñ•É•Ì¸œè9¼Í”¡„Á½‘¥‘¼½¹™¥Éµ…È•°…•Í¼¸œ¤íô(€™¥¹…±±åíÍÕ‰µ¥ÑÑ•È¹‘¥Í…‰±•õ™…±Í”íô)ô¤ì( œ¹½Ñ¥™¥…Ñ¥½¸µ‰ÕÑÑ½¸œ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ° ¤ôùí…Ñ¥Ù•M•Ñ¥½¸ô¹½Ñ¥™¥…Ñ¥½¹ÌœíÉ•¹‘•ÉM¡•±° ¤íô¤ì()¥˜¡ÁÉ½‘ÕÑ¥½¹5½‘”¥ì(€€ œ¹Ñ•ÍÐµ‰…¹¹•Èœ¤¹¡¥‘‘•¸õÑÉÕ”ì œ¹‘•µ¼µ…•ÍÌœ¤¹¡¥‘‘•¸ô…ÉÕ¹Ñ¥µ•½¹™¥œ¹…±±½Ý•µ½•ÍÌì(€¥˜¡Á±…Ñ™½ÉµÁ¤¥í½¹ÍÐ…±±‰…­QåÁ”õÁ±…Ñ™½ÉµÁ¤¹½¹ÍÕµ•UÉ±M•ÍÍ¥½¸¡±½…Ñ¥½¸¹¡É•˜¤í¥˜¡…±±‰…­QåÁ”ôôôÉ•½Ù•Éäññ…±±‰…­QåÁ”ôôô¥¹Ù¥Ñ”œ¤ œÁ…ÍÍÝ½Éµ‘¥…±½œœ¤¹Í¡½Ý5½‘…° ¤í•±Í”•¹Ñ•ÉAÉ½‘ÕÑ¥½¸ ¤¹…Ñ   ¤ôùíô¤íô)õ•±Í”¥˜¡ÍÑ…Ñ”¹…Ñ¥Ù•I½±”¥•¹Ñ•È¡ÍÑ…Ñ”¹…Ñ¥Ù•I½±”¤ì(
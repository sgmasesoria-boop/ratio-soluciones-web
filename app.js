const STORAGE_KEY = 'ratio-platform-crm-v1';
const runtimeConfig = window.RATIO_CONFIG || { mode: 'demo', allowDemoAccess: true };
const productionMode = runtimeConfig.mode === 'production';
const applicationMode = ['crm','portal'].includes(runtimeConfig.appMode) ? runtimeConfig.appMode : 'combined';
let platformApi = null;
if (productionMode) {
  try { platformApi = new window.RatioPlatformApi(runtimeConfig); }
  catch (error) { console.error('Configuración de plataforma no válida', error); }
}

const now = new Date();
const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60000).toISOString();
const statusLabels = { open:'Abierto', study:'En estudio', action:'Gestiones en curso', response:'Respuesta recibida', resolution:'Resolución', closed:'Cerrado', archived:'Archivado' };
const statusStages = { open:0, study:1, action:2, response:3, resolution:4, closed:5, archived:5 };
const leadStatusLabels = { new:'Nueva', review:'En estudio', waiting:'Falta información', viable:'Viable', proposal:'Propuesta enviada', contract:'Contrato pendiente', won:'Contratada', lost:'No viable / cerrada' };

const seed = {
  activeRole: null,
  users: {
    client: { id:'usr_client_01', name:'Carlos Martín', initials:'CM', role:'Cliente' },
    admin: { id:'usr_admin_01', name:'Sergio Guerrero', initials:'SG', role:'Gestor' }
  },
  cases: [
    {
      id:'case_01', reference:'RS-2048', clientId:'usr_client_01', client:'Carlos Martín',
      title:'Revisión de financiación', category:'Banca y financiación', statusCode:'action',
      status:'Gestiones en curso', stage:2, openedAt:iso(4320),
      clientNextStep:'No tienes que hacer nada ahora. Te avisaremos cuando exista una novedad o necesitemos una decisión.',
      professionalName:'Laura Fernández Ruiz', professionalTitle:'Letrada responsable',
      professionalRegistration:'ICAGR n.º 0000 · dato ficticio', professionalRegion:'Andalucía'
    },
    {
      id:'case_02', reference:'RS-2051', clientId:'usr_client_02', client:'Ana Romero',
      title:'Incidencia en comunidad de propietarios', category:'Vivienda', statusCode:'study',
      status:'En estudio', stage:1, openedAt:iso(7200),
      clientNextStep:'Estamos comprobando la información inicial. Te avisaremos si necesitamos alguna aclaración.',
      professionalName:'Miguel Torres Sánchez', professionalTitle:'Profesional responsable',
      professionalRegistration:'Dato profesional ficticio', professionalRegion:'Madrid'
    },
    {
      id:'case_03', reference:'RS-2056', clientId:'usr_client_03', client:'Lucía Navarro',
      title:'Reclamación de indemnización', category:'Seguros e indemnizaciones', statusCode:'response',
      status:'Respuesta recibida', stage:3, openedAt:iso(10080),
      clientNextStep:'Hemos recibido una respuesta. La estamos valorando antes de explicarte las opciones.',
      professionalName:'Elena Ruiz Moreno', professionalTitle:'Profesional responsable',
      professionalRegistration:'Dato profesional ficticio', professionalRegion:'Andalucía'
    }
  ],
  events: [
    { id:'evt_01', caseId:'case_01', kind:'open', title:'Expediente abierto', description:'Tu acceso privado ha quedado confirmado.', at:iso(4320), done:true },
    { id:'evt_02', caseId:'case_01', kind:'study', title:'Información inicial revisada', description:'Hemos situado el problema y definido las primeras comprobaciones.', at:iso(2880), done:true },
    { id:'evt_03', caseId:'case_01', kind:'action', title:'Gestión en curso', description:'Estamos revisando las condiciones de la financiación.', at:iso(180), current:true },
    { id:'evt_04', caseId:'case_02', kind:'open', title:'Expediente abierto', description:'La consulta ha sido aceptada y registrada.', at:iso(7200), done:true },
    { id:'evt_05', caseId:'case_02', kind:'study', title:'Información en estudio', description:'Estamos analizando los antecedentes de la comunidad.', at:iso(420), current:true },
    { id:'evt_06', caseId:'case_03', kind:'open', title:'Expediente abierto', description:'La reclamación ha quedado registrada.', at:iso(10080), done:true },
    { id:'evt_07', caseId:'case_03', kind:'action', title:'Reclamación presentada', description:'La solicitud de indemnización fue comunicada a la entidad.', at:iso(5760), done:true },
    { id:'evt_08', caseId:'case_03', kind:'response', title:'Respuesta recibida', description:'Estamos revisando la contestación antes de comunicar las opciones.', at:iso(90), current:true }
  ],
  notifications: [{ id:'not_01', userId:'usr_client_01', caseId:'case_01', title:'Nuevo avance en tu expediente', body:'La revisión de la financiación está en curso.', at:iso(180), read:false }],
  leads: [
    { id:'lead_01', reference:'C-2026-001', name:'María López', phone:'600 000 001', email:'maria@example.es', province:'Granada', category:'Banca y financiación', source:'Formulario web', summary:'Consulta sobre una tarjeta revolving cuya deuda no disminuye.', status:'review', nextAction:'Revisar contrato y movimientos indicados durante la llamada', followUp:new Date(now.getTime()+86400000).toISOString().slice(0,10), amount:650, privacyNoticeAt:iso(1440), legalBasis:'precontractual_request', createdAt:iso(1440), updatedAt:iso(120), notes:[{id:'note_01',body:'Contacto inicial realizado. Pendiente de comprobación de viabilidad.',at:iso(120)}] },
    { id:'lead_02', reference:'C-2026-002', name:'Antonio Ruiz', phone:'600 000 002', email:'antonio@example.es', province:'Madrid', category:'Vivienda', source:'Recomendación', summary:'Necesita orientación ante un conflicto en su comunidad de propietarios.', status:'new', nextAction:'Realizar primer contacto', followUp:new Date(now.getTime()+172800000).toISOString().slice(0,10), amount:0, privacyNoticeAt:iso(240), legalBasis:'precontractual_request', createdAt:iso(240), updatedAt:iso(240), notes:[] }
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
let mfaFactorId = '';
let mfaEnrollment = false;

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
    return { ...structuredClone(seed), ...stored, cases:[...storedCases,...structuredClone(newDemoCases)], events:[...storedEvents,...structuredClone(newDemoEvents)], leads, tasks:stored.tasks || [], audit:stored.audit || [] };
  }
  catch { return structuredClone(seed); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function setBrowserRoute(path) {
  if (/^https?:$/.test(location.protocol) && location.pathname !== path) history.replaceState({}, '', path);
}
function currentUser() { return state.users[state.activeRole]; }
function currentCase() { return state.cases.find(item => item.id === activeCaseId) || state.cases[0]; }
function log(action, objectType, objectId, metadata = {}) {
  state.audit.push({ id:crypto.randomUUID(), actorId:currentUser()?.id, action, objectType, objectId, metadata, at:new Date().toISOString() });
}

function mapProductionWorkspace(workspace, authUser) {
  const profile = workspace.profile;
  if (!profile?.active) throw new Error('PROFILE_NOT_ACTIVE');
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
      amount:Number(item.quoted_amount || 0), privacyNoticeAt:item.privacy_notice_at, legalBasis:item.legal_basis, createdAt:item.created_at,
      updatedAt:item.updated_at, notes:[]
    })),
    tasks:(workspace.tasks || []).map(item => ({ id:item.id, leadId:item.lead_id, title:item.title, dueDate:item.due_on, priority:item.priority, completed:Boolean(item.completed_at), createdAt:item.created_at })),
    audit:[]
  };
}

function enter(role) {
  if ((applicationMode === 'crm' && role !== 'admin') || (applicationMode === 'portal' && role !== 'client')) return;
  state.activeRole = role;
  saveState();
  $('#login-view').hidden = true;
  $('#app').hidden = false;
  activeSection = 'overview';
  activeCaseId = state.cases[0]?.id || null;
  setBrowserRoute('/app');
  renderShell();
}
async function enterProduction() {
  if (!platformApi) throw new Error('La conexión segura todavía no está configurada.');
  const user = await platformApi.currentUser();
  if (!user) return false;
  const profile = await platformApi.loadProfile(user.id);
  if (!profile?.active) {
    await platformApi.signOut();
    throw new Error('PROFILE_NOT_ACTIVE');
  }
  const role = profile.internal_role === 'client' ? 'client' : 'admin';
  if ((applicationMode === 'crm' && role !== 'admin') || (applicationMode === 'portal' && role !== 'client')) {
    await platformApi.signOut();
    throw new Error('ROLE_NOT_ALLOWED');
  }
  if (role === 'admin' && platformApi.assuranceLevel() !== 'aal2') {
    await openInternalMfa(user);
    return false;
  }
  const workspace = await platformApi.loadWorkspace(user.id);
  workspace.profile = profile;
  state = mapProductionWorkspace(workspace, user);
  activeCaseId = state.cases[0]?.id || null;
  $('#login-view').hidden = true;
  $('#app').hidden = false;
  activeSection = 'overview';
  setBrowserRoute('/app');
  renderShell();
  return true;
}

async function openInternalMfa(user) {
  $('#app').hidden = true;
  $('#login-view').hidden = false;
  const factors = Array.isArray(user?.factors) ? user.factors.filter(item => item.factor_type === 'totp') : [];
  const verified = factors.find(item => item.status === 'verified');
  mfaEnrollment = !verified;
  $('#mfa-enrollment').hidden = !mfaEnrollment;
  $('#mfa-dialog-title').textContent = mfaEnrollment ? 'Protege tu cuenta con una app de autenticación' : 'Introduce tu segundo factor';
  $('#mfa-dialog-description').textContent = mfaEnrollment
    ? 'El acceso al CRM exige un segundo factor. Escanea el código y confirma uno de los códigos temporales.'
    : 'Abre tu app de autenticación e introduce el código temporal para continuar.';
  if (verified) {
    mfaFactorId = verified.id;
  } else {
    for (const stale of factors.filter(item => item.status !== 'verified')) {
      try { await platformApi.unenrollFactor(stale.id); } catch { /* Se creará un factor nuevo igualmente. */ }
    }
    const enrolled = await platformApi.enrollTotp('CRM Ratio Soluciones');
    mfaFactorId = enrolled.id;
    const qr = $('#mfa-qr');
    const fallback = $('#mfa-qr-fallback');
    const source = mfaQrSource(enrolled.totp?.qr_code);
    qr.hidden = !source;
    fallback.hidden = Boolean(source);
    qr.onload = () => { qr.hidden = false; fallback.hidden = true; };
    qr.onerror = () => { qr.hidden = true; fallback.hidden = false; };
    if (source) qr.src = source;
    else qr.removeAttribute('src');
    $('#mfa-secret').textContent = enrolled.totp?.secret || '';
  }
  if (!$('#mfa-dialog').open) $('#mfa-dialog').showModal();
  requestAnimationFrame(() => $('#mfa-code').focus());
}

function mfaQrSource(value) {
  const qr = String(value || '').trim();
  if (qr.startsWith('data:image/')) return qr;
  if (qr.startsWith('<svg')) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
  return '';
}
async function logout() {
  if (productionMode && platformApi) await platformApi.signOut();
  state.activeRole = null;
  if (!productionMode) saveState();
  $('#app').hidden = true;
  $('#login-view').hidden = false;
  if ($('#mfa-dialog')?.open) $('#mfa-dialog').close();
  setBrowserRoute('/');
  $('.sidebar').classList.remove('open');
}

function renderShell() {
  const user = currentUser();
  const isAdmin = state.activeRole === 'admin';
  $('#workspace-kicker').textContent = isAdmin ? 'Gestión interna' : 'Espacio privado';
  $('#workspace-name').textContent = isAdmin ? 'CRM y expedientes' : 'Mi expediente';
  $('#header-kicker').textContent = isAdmin ? 'Ratio Soluciones' : 'Plataforma privada';
  $('#header-title').textContent = isAdmin ? 'CRM y gestión de expedientes' : 'Mi expediente';
  $('#profile-initials').textContent = user.initials;
  $('#profile-role').textContent = user.role;
  $('#profile-name').textContent = user.name;
  const unread = state.notifications.filter(n => n.userId === user.id && !n.read).length;
  $('#notification-count').textContent = unread;
  $('#notification-count').hidden = unread === 0;
  const items = isAdmin
    ? [['overview','Resumen'],['leads','Consultas'],['tasks','Agenda'],['cases','Expedientes'],['finance','Control económico'],['notifications','Avisos'],['audit','Registro de actividad']]
    : [['overview','Resumen'],['timeline','Cronología'],['notifications','Avisos'],['security','Acceso y seguridad']];
  $('#app-nav').innerHTML = items.map(([id,label]) => `<button type="button" data-section="${id}" class="${activeSection===id?'active':''}">${label}</button>`).join('');
  $$('[data-section]').forEach(button => button.addEventListener('click', () => {
    activeSection=button.dataset.section;
    if (isAdmin && activeSection === 'cases') activeCaseId=null;
    renderShell();
    $('.sidebar').classList.remove('open');
  }));
  renderMain();
}

function renderMain() {
  if (!state.cases.length && state.activeRole !== 'admin') {
    $('#main').innerHTML = `${pageHead('Plataforma privada','Todavía no hay expedientes asignados','Tu acceso está activo. Cuando se abra el primer expediente aparecerá aquí.')}<section class="panel"><div class="empty">No hay expedientes disponibles.</div></section>`;
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
    $('#main').innerHTML = `${pageHead(c.reference,c.title,'Consulta el estado real del expediente y cada actuación ya registrada.','<span class="status-pill">'+escapeHtml(c.status)+'</span>')}
      <div class="case-layout"><section class="panel"><div class="panel-head"><h2>Recorrido del expediente</h2><small>Sin fechas estimadas</small></div>${progress(c.stage)}${timeline()}</section><aside>${nextStepCard(c)}${professionalCard(c)}</aside></div>`;
  } else if (activeSection === 'timeline') {
    $('#main').innerHTML = `${pageHead('Cronología','Cada actuación, en orden','El historial muestra hechos ya registrados. No incluye fechas estimadas de resolución.')}<section class="panel">${timeline(true)}</section>`;
  } else if (activeSection === 'notifications') {
    markNotificationsRead();
    $('#main').innerHTML = `${pageHead('Avisos','Novedades de tu caso','Los avisos te indican cuándo existe un avance o necesitamos una decisión.')}<section class="panel"><div class="notification-list">${notificationList()}</div></section>`;
  } else {
    $('#main').innerHTML = `${pageHead('Seguridad','Tu acceso','Controla tu sesión y protege el acceso al expediente.')}<div class="case-layout"><section class="panel"><div class="panel-head"><h2>Doble factor de autenticación</h2><span class="status-pill">Obligatorio para el equipo</span></div><p class="panel-copy">Las cuentas internas no podrán utilizarse con clientes reales hasta que el doble factor esté activado y verificado en el proveedor de identidad.</p></section><section class="panel"><div class="panel-head"><h2>Privacidad del portal</h2></div><p class="panel-copy">Este espacio muestra estados, avances y responsables. No permite adjuntar ni almacenar documentos.</p></section></div>`;
  }
}

function renderAdmin() {
  const c = state.cases.find(item => item.id === activeCaseId) || null;
  const activeCases = state.cases.filter(item => !['closed','archived'].includes(item.statusCode)).length;
  const openLeads = state.leads.filter(item => !['won','lost'].includes(item.status)).length;
  const pendingTasks = state.tasks.filter(item => !item.completed).length;
  const pipelineAmount = state.leads.filter(item => !['lost'].includes(item.status)).reduce((total,item)=>total+Number(item.amount||0),0);
  if (activeSection === 'overview') {
    $('#main').innerHTML = `${pageHead('Gestión interna','Resumen operativo','Controla desde aquí cada consulta hasta convertirla en expediente.','<button class="secondary-button" id="new-task">Nueva tarea</button><button class="primary-button" id="new-lead">Registrar consulta <span>→</span></button>')}
      <div class="metric-grid"><div class="metric"><small>Consultas abiertas</small><strong>${openLeads}</strong><span>En seguimiento</span></div><div class="metric"><small>Tareas pendientes</small><strong>${pendingTasks}</strong><span>Agenda interna</span></div><div class="metric"><small>Expedientes activos</small><strong>${activeCases}</strong><span>Clientes contratados</span></div><div class="metric"><small>Presupuestado</small><strong>${formatMoney(pipelineAmount)}</strong><span>Sin incluir descartadas</span></div></div>
      <div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Consultas que requieren atención</h2><small>${openLeads} abiertas</small></div>${leadTable(state.leads.filter(item=>!['won','lost'].includes(item.status)).slice(0,6))}</section><section class="panel"><div class="panel-head"><h2>Próximas actuaciones</h2><small>Uso interno</small></div>${taskList(state.tasks.filter(item=>!item.completed).slice(0,6))}</section></div>`;
    bindCrmActions();
  } else if (activeSection === 'leads') {
    $('#main').innerHTML = `${pageHead('CRM','Consultas y oportunidades','Cada contacto conserva su origen, consentimiento, estado y próxima actuación.','<button class="primary-button" id="new-lead">Registrar consulta <span>→</span></button>')}<section class="panel"><div class="pipeline-board">${leadPipeline()}</div></section>`;
    bindCrmActions();
  } else if (activeSection === 'tasks') {
    $('#main').innerHTML = `${pageHead('Agenda interna','Próximas actuaciones','Las fechas son recordatorios internos y nunca se muestran como promesas al cliente.','<button class="primary-button" id="new-task">Nueva tarea <span>→</span></button>')}<section class="panel">${taskList(state.tasks)}</section>`;
    bindCrmActions();
  } else if (activeSection === 'cases') {
    if (!state.cases.length) {
      $('#main').innerHTML = `${pageHead('Expedientes','Todavía no hay expedientes','Convierte una consulta contratada en expediente para crear el acceso privado.')}<section class="panel"><div class="empty">No hay expedientes disponibles.</div></section>`;
    } else if (!c) {
      $('#main').innerHTML = `${pageHead('Expedientes','Todos los expedientes',`${state.cases.length} expedientes disponibles. Selecciona uno para consultar su estado, cronología y profesional asignado.`)}<section class="panel"><div class="panel-head"><h2>Listado de expedientes</h2><small>${state.cases.length} en total</small></div>${caseTable()}</section>`;
      bindCaseRows();
    } else {
      $('#main').innerHTML = `${pageHead('Expedientes',c.reference+' · '+c.client,c.title,'<button class="secondary-button" id="back-to-cases">← Todos los expedientes</button><button class="primary-button" id="new-update">Registrar avance →</button>')}<div class="case-layout"><section class="panel"><div class="panel-head"><h2>Cronología</h2><span class="status-pill">${escapeHtml(c.status)}</span></div>${timeline(true)}</section><aside>${nextStepCard(c)}${professionalCard(c)}</aside></div>`;
      $('#back-to-cases').addEventListener('click',()=>{activeCaseId=null;renderShell();});
      $('#new-update').addEventListener('click',openUpdateDialog);
    }
  } else if (activeSection === 'finance') {
    const won = state.leads.filter(item=>item.status==='won');
    $('#main').innerHTML = `${pageHead('Control económico','Contrataciones e importes','Resumen interno para controlar lo presupuestado. La facturación definitiva se conectará en una fase posterior.')}<div class="metric-grid"><div class="metric"><small>Contrataciones</small><strong>${won.length}</strong><span>Consultas ganadas</span></div><div class="metric"><small>Importe contratado</small><strong>${formatMoney(won.reduce((t,i)=>t+Number(i.amount||0),0))}</strong><span>Importe presupuestado</span></div><div class="metric"><small>Propuestas abiertas</small><strong>${state.leads.filter(i=>['viable','proposal','contract'].includes(i.status)).length}</strong><span>Pendientes de decisión</span></div><div class="metric"><small>Liquidaciones</small><strong>—</strong><span>Fase posterior</span></div></div><section class="panel">${leadTable(state.leads.filter(i=>i.amount>0))}</section>`;
    bindCrmActions();
  } else if (activeSection === 'notifications') {
    $('#main').innerHTML = `${pageHead('Avisos','Registro de notificaciones','Cada aviso queda vinculado a un expediente y a un avance concreto.')}<section class="panel"><div class="notification-list">${notificationList(true)}</div></section>`;
  } else {
    $('#main').innerHTML = `${pageHead('Auditoría','Registro de actividad','Altas, accesos y avances se conservan en un registro no editable por usuarios ordinarios.')}<section class="panel">${auditTable()}</section>`;
  }
}

function formatMoney(value) { return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(value||0)); }
function leadTable(list=state.leads) {
  if (!list.length) return '<div class="empty">No hay consultas en este estado.</div>';
  return `<table class="case-table"><thead><tr><th>Referencia</th><th>Contacto</th><th>Área</th><th>Estado</th><th>Seguimiento</th></tr></thead><tbody>${list.map(item=>`<tr tabindex="0" data-lead-id="${escapeHtml(item.id)}"><td class="case-ref">${escapeHtml(item.reference)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td><span class="lead-status status-${escapeHtml(item.status)}">${escapeHtml(leadStatusLabels[item.status]||item.status)}</span></td><td>${escapeHtml(item.followUp?formatShortDate(item.followUp):'Sin fecha')}</td></tr>`).join('')}</tbody></table>`;
}
function leadPipeline() {
  const groups=[['new','Nuevas'],['review','En estudio'],['waiting','Falta información'],['viable','Viables'],['proposal','Propuesta'],['contract','Contrato'],['won','Contratadas'],['lost','Cerradas']];
  return groups.map(([status,label])=>{const list=state.leads.filter(item=>item.status===status);return `<section class="pipeline-column"><header><strong>${label}</strong><span>${list.length}</span></header>${list.map(item=>`<button type="button" class="lead-card" data-lead-id="${escapeHtml(item.id)}"><small>${escapeHtml(item.reference)} · ${escapeHtml(item.province||'Sin provincia')}</small><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)}</p><em>${escapeHtml(item.nextAction||'Sin próxima actuación')}</em></button>`).join('')||'<p class="pipeline-empty">Sin consultas</p>'}</section>`;}).join('');
}
function taskList(list=state.tasks) {
  if (!list.length) return '<div class="empty">No hay tareas pendientes.</div>';
  return `<div class="task-list">${[...list].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(task=>{const lead=state.leads.find(item=>item.id===task.leadId);return `<article class="task-row ${task.completed?'completed':''}"><button type="button" class="task-check" data-task-id="${escapeHtml(task.id)}" aria-label="${task.completed?'Reabrir':'Completar'} tarea">${task.completed?'✓':''}</button><div><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(lead?lead.name+' · '+lead.reference:'Sin consulta asociada')}</p></div><time class="${task.priority==='high'?'priority-high':''}">${escapeHtml(formatShortDate(task.dueDate))}</time></article>`;}).join('')}</div>`;
}
function formatShortDate(value) { if(!value)return ''; return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)); }

function progress(stage) {
  const labels=['Abierto','Estudio','Gestiones','Respuesta','Resolución','Cerrado'];
  return `<div class="progress-track">${labels.map((label,i)=>`<div class="progress-step ${i<stage?'done':i===stage?'active':''}"><i>${i<stage?'✓':i+1}</i><span>${label}</span></div>`).join('')}</div>`;
}
function timeline(full=false) {
  const events=state.events.filter(e=>e.caseId===currentCase().id).sort((a,b)=>new Date(a.at)-new Date(b.at));
  return `<div class="timeline">${events.map((e,i)=>`<article class="event ${e.current?'current':''}"><span class="event-mark">${e.done?'✓':String(i+1).padStart(2,'0')}</span><div class="event-body"><small>${formatDate(e.at)} · ${e.done?'Registrado':e.current?'Estado actual':'Avance'}</small><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(e.description)}</p></div></article>`).join('')}${full?'<article class="event"><span class="event-mark">—</span><div class="event-body"><small>Siguiente avance</small><strong>Se añadirá cuando ocurra</strong><p>No mostramos fechas previstas que todavía no pueden confirmarse.</p></div></article>':''}</div>`;
}
function nextStepCard(c) {
  const hasAction=Boolean(c.clientNextStep);
  return `<section class="panel next-step-card"><div class="panel-head"><h2>${hasAction?'Qué necesitamos de ti':'Tu siguiente paso'}</h2><small>${hasAction?'Acción indicada':'Sin tareas'}</small></div><p>${escapeHtml(hasAction?c.clientNextStep:'No tienes que hacer nada ahora. Te avisaremos cuando exista una novedad.')}</p></section>`;
}
function professionalCard(c) {
  const assigned=Boolean(c.professionalName);
  return `<section class="panel professional-card"><div class="panel-head"><h2>Profesional asignado</h2><small>${assigned?'Identificado':'Pendiente'}</small></div>${assigned?`<div class="professional-profile"><span>${escapeHtml(initials(c.professionalName))}</span><div><strong>${escapeHtml(c.professionalName)}</strong><p>${escapeHtml(c.professionalTitle || 'Profesional responsable')}</p><small>${escapeHtml([c.professionalRegistration,c.professionalRegion].filter(Boolean).join(' · '))}</small></div></div>`:'<p class="panel-copy">Te informaremos de su identidad y acreditación cuando se asigne la intervención.</p>'}</section>`;
}
function caseTable() {
  return `<table class="case-table"><thead><tr><th>Referencia</th><th>Cliente</th><th>Área</th><th>Estado</th></tr></thead><tbody>${state.cases.map(c=>`<tr tabindex="0" data-case-id="${escapeHtml(c.id)}"><td class="case-ref">${escapeHtml(c.reference)}</td><td>${escapeHtml(c.client)}</td><td>${escapeHtml(c.category)}</td><td><span class="status-pill">${escapeHtml(c.status)}</span></td></tr>`).join('')}</tbody></table>`;
}
function bindCaseRows() {
  $$('[data-case-id]').forEach(row => {
    const open=()=>{activeCaseId=row.dataset.caseId;activeSection='cases';renderShell();};
    row.addEventListener('click',open);
    row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
}
function notificationList(all=false) {
  const list=all?state.notifications:state.notifications.filter(n=>n.userId===currentUser().id);
  return list.length?list.map(n=>`<article class="notice ${n.read?'read':''}"><i></i><div><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p></div><time>${formatDate(n.at)}</time></article>`).join(''):'<div class="empty">No hay avisos.</div>';
}
function auditTable() {
  if(!state.audit.length)return '<div class="empty">Las acciones realizadas en esta prueba aparecerán aquí.</div>';
  return `<table class="case-table"><thead><tr><th>Momento</th><th>Acción</th><th>Objeto</th><th>Usuario</th></tr></thead><tbody>${[...state.audit].reverse().map(a=>`<tr><td>${formatDate(a.at)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.objectType)} · ${escapeHtml(String(a.objectId).slice(0,12))}</td><td>${escapeHtml(a.actorId)}</td></tr>`).join('')}</tbody></table>`;
}

function bindCrmActions() {
  $('#new-lead')?.addEventListener('click',()=>$('#lead-dialog').showModal());
  $('#new-task')?.addEventListener('click',openTaskDialog);
  $$('[data-lead-id]').forEach(node=>{
    const open=()=>openLeadDialog(node.dataset.leadId);
    node.addEventListener('click',open);
    node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
  $$('[data-task-id]').forEach(button=>button.addEventListener('click',()=>toggleTask(button.dataset.taskId)));
}
function openLeadDialog(leadId) {
  const lead=state.leads.find(item=>item.id===leadId); if(!lead)return;
  $('#lead-detail-id').value=lead.id;
  $('#lead-detail-title').textContent=`${lead.reference} · ${lead.name}`;
  $('#lead-detail-contact').innerHTML=`<div><small>Contacto</small><strong>${escapeHtml(lead.phone||'Sin teléfono')}</strong><span>${escapeHtml(lead.email||'Sin correo')}</span></div><div><small>Consulta</small><strong>${escapeHtml(lead.category)}</strong><span>${escapeHtml(lead.summary)}</span></div><div><small>Privacidad</small><strong>Información entregada</strong><span>${escapeHtml(formatDate(lead.privacyNoticeAt))}</span></div>`;
  $('#lead-detail-phone').value=lead.phone||'';
  $('#lead-detail-email').value=lead.email||'';
  $('#lead-detail-status').value=lead.status;
  $('#lead-detail-next-action').value=lead.nextAction||'';
  $('#lead-detail-follow-up').value=String(lead.followUp||'').slice(0,10);
  $('#lead-detail-amount').value=lead.amount||'';
  $('#lead-detail-note').value='';
  $('#convert-lead').disabled=lead.status==='won';
  $('#lead-detail-dialog').showModal();
}
function openTaskDialog() {
  $('#task-lead').innerHTML=state.leads.filter(item=>!['won','lost'].includes(item.status)).map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference+' · '+item.name)}</option>`).join('');
  $('#task-date').value=new Date().toISOString().slice(0,10);
  $('#task-dialog').showModal();
}
async function toggleTask(taskId) {
  const task=state.tasks.find(item=>item.id===taskId); if(!task)return;
  task.completed=!task.completed;
  if(productionMode&&platformApi){
    try{await platformApi.update('crm_tasks',`id=eq.${encodeURIComponent(task.id)}`,{completed_at:task.completed?new Date().toISOString():null});}
    catch{task.completed=!task.completed;toast('No se ha podido actualizar la tarea.');return;}
  } else { log(task.completed?'task_completed':'task_reopened','crm_task',task.id);saveState(); }
  renderShell();
}
function nextLeadReference() {
  const year=new Date().getFullYear();
  const maximum=state.leads.reduce((max,item)=>Math.max(max,Number(String(item.reference||'').split('-').pop())||0),0);
  return `C-${year}-${String(maximum+1).padStart(3,'0')}`;
}

function openUpdateDialog() {
  const c=currentCase();
  $('#update-status').value=c.statusCode;
  $('#update-title').value='';
  $('#update-description').value='';
  $('#update-next-step').value=c.clientNextStep || '';
  $('#professional-name').value=c.professionalName || '';
  $('#professional-title').value=c.professionalTitle || '';
  $('#professional-registration').value=c.professionalRegistration || '';
  $('#professional-region').value=c.professionalRegion || '';
  $('#update-dialog').showModal();
}
function markNotificationsRead() {
  const unread=state.notifications.filter(n=>n.userId===currentUser().id&&!n.read);
  unread.forEach(n=>n.read=true);
  if(productionMode&&platformApi)unread.forEach(n=>platformApi.update('notifications',`id=eq.${encodeURIComponent(n.id)}`,{read_at:new Date().toISOString()}).catch(()=>{}));
  else saveState();
}
function toast(message) {
  const node=$('#toast');node.textContent=message;node.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.hidden=true,3200);
}

function configureApplicationMode() {
  const clientButton=$('[data-demo-role="client"]'),adminButton=$('[data-demo-role="admin"]');
  if(applicationMode==='crm'){
    clientButton.hidden=true;adminButton.hidden=false;
    $('.login-card>.kicker').textContent='Gestión interna';
    $('#login-title').textContent='Accede al CRM';
    $('.login-lead').textContent='Gestiona consultas, tareas, contrataciones y expedientes desde un espacio privado de Ratio Soluciones.';
    $('.demo-access p').textContent='Entorno interno de prueba con datos ficticios';
    $('.test-banner').textContent='CRM DE PRUEBA · DATOS FICTICIOS · SIN DOCUMENTACIÓN';
    document.title='CRM privado | Ratio Soluciones';
  }else if(applicationMode==='portal'){
    adminButton.hidden=true;clientButton.hidden=false;
    $('.demo-access p').textContent='Portal de cliente de prueba con datos ficticios';
    $('.test-banner').textContent='PORTAL DE CLIENTE · DATOS FICTICIOS · SIN DOCUMENTACIÓN';
    document.title='Portal de clientes | Ratio Soluciones';
  }
}
configureApplicationMode();
$$('[data-demo-role]').forEach(button=>button.addEventListener('click',()=>enter(button.dataset.demoRole)));
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!productionMode){enter(applicationMode==='crm'?'admin':'client');return;}
  const button=event.submitter;button.disabled=true;
  try{const data=new FormData(event.currentTarget);await platformApi.signIn(data.get('email'),data.get('password'));await enterProduction();}
  catch(error){toast(error?.status===400?'Correo o contraseña incorrectos.':'No se ha podido iniciar sesión de forma segura.');}
  finally{button.disabled=false;}
});
$('#logout').addEventListener('click',logout);
$('#recover-access').addEventListener('click',async()=>{
  const email=$('#login-form input[name="email"]').value.trim();
  if(!productionMode){toast('En producción recibirás un enlace seguro para recuperar el acceso.');return;}
  if(!email){toast('Escribe primero tu correo electrónico.');return;}
  try{await platformApi.requestPasswordReset(email,`${location.origin}/restablecer`);toast('Si el correo está registrado, recibirás un enlace de recuperación.');}
  catch{toast('No se ha podido solicitar la recuperación. Inténtalo de nuevo.');}
});
$('#mobile-menu').addEventListener('click',()=>$('.sidebar').classList.toggle('open'));
$('#update-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#update-dialog').close();return;}
  const payload={
    caseId:currentCase().id,status:$('#update-status').value,title:$('#update-title').value.trim(),description:$('#update-description').value.trim(),
    clientNextStep:$('#update-next-step').value.trim(),professionalName:$('#professional-name').value.trim(),professionalTitle:$('#professional-title').value.trim(),
    professionalRegistration:$('#professional-registration').value.trim(),professionalRegion:$('#professional-region').value.trim()
  };
  if(!payload.title||!payload.description)return;
  const submitter=event.submitter;const originalLabel=submitter.innerHTML;submitter.disabled=true;submitter.textContent='Guardando avance…';
  try{
    if(productionMode&&platformApi){
      await platformApi.invoke('update-case',payload);
      await enterProduction();
      activeCaseId=payload.caseId;
      activeSection='cases';
      renderShell();
    }
    else{
      const c=currentCase();Object.assign(c,{statusCode:payload.status,status:statusLabels[payload.status],stage:statusStages[payload.status],clientNextStep:payload.clientNextStep,professionalName:payload.professionalName,professionalTitle:payload.professionalTitle,professionalRegistration:payload.professionalRegistration,professionalRegion:payload.professionalRegion});
      const at=new Date().toISOString();state.events.forEach(item=>item.current=false);state.events.push({id:crypto.randomUUID(),caseId:c.id,kind:payload.status,title:payload.title,description:payload.description,at,current:true});
      state.notifications.push({id:crypto.randomUUID(),userId:state.users.client.id,caseId:c.id,title:'Nuevo avance en tu expediente',body:payload.title,at,read:false});
      log('case_updated','case',c.id,{status:payload.status});saveState();renderShell();
    }
    $('#update-form').reset();$('#update-dialog').close();toast('Avance guardado y aviso registrado.');
  }catch(error){
    const messages={UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',FORBIDDEN:'Tu usuario no tiene permiso para modificar expedientes.',INVALID_FIELDS:'Revisa el estado, el título y la descripción.'};
    toast(messages[error?.code]||`No se ha podido guardar el avance${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }
  finally{submitter.disabled=false;submitter.innerHTML=originalLabel;}
});
$('#invite-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#invite-dialog').close();return;}
  const payload={email:$('#invite-email').value.trim(),displayName:$('#invite-name').value.trim(),title:$('#invite-title').value.trim(),category:$('#invite-category').value};
  if(!productionMode||!platformApi){toast('El alta real se habilitará al conectar el servidor europeo.');return;}
  const submitter=event.submitter;submitter.disabled=true;
  try{const created=await platformApi.invoke('invite-client',payload);await enterProduction();activeCaseId=created.caseId;activeSection='cases';renderShell();$('#invite-form').reset();$('#invite-dialog').close();toast('Expediente creado e invitación enviada.');}
  catch{toast('No se ha podido completar el alta. Revisa el correo y vuelve a intentarlo.');}
  finally{submitter.disabled=false;}
});
$('#lead-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#lead-dialog').close();return;}
  const payload={
    fullName:$('#lead-name').value.trim(),phone:$('#lead-phone').value.trim(),email:$('#lead-email').value.trim().toLowerCase(),province:$('#lead-province').value.trim(),
    category:$('#lead-category').value,source:$('#lead-source').value,summary:$('#lead-summary').value.trim(),privacyNoticeAcknowledged:Boolean($('#lead-privacy-notice').checked)
  };
  if(!payload.phone||!payload.email){toast('Indica el teléfono y el correo electrónico.');return;}
  const submitter=event.submitter;submitter.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'create_lead',...payload});await enterProduction();}
    else{
      const at=new Date().toISOString();const id=crypto.randomUUID();
      state.leads.unshift({id,reference:nextLeadReference(),name:payload.fullName,phone:payload.phone,email:payload.email,province:payload.province,category:payload.category,source:payload.source,summary:payload.summary,status:'new',nextAction:'Realizar primer contacto',followUp:'',amount:0,privacyNoticeAt:at,legalBasis:'precontractual_request',createdAt:at,updatedAt:at,notes:[]});
      log('lead_created','crm_lead',id,{source:payload.source});saveState();
    }
    $('#lead-form').reset();$('#lead-dialog').close();activeSection='leads';renderShell();toast('Consulta registrada correctamente.');
  }catch{toast('No se ha podido registrar la consulta.');}
  finally{submitter.disabled=false;}
});
$('#lead-detail-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#lead-detail-dialog').close();return;}
  const lead=state.leads.find(item=>item.id===$('#lead-detail-id').value);if(!lead)return;
  const changes={phone:$('#lead-detail-phone').value.trim(),email:$('#lead-detail-email').value.trim().toLowerCase(),status:$('#lead-detail-status').value,nextAction:$('#lead-detail-next-action').value.trim(),followUp:$('#lead-detail-follow-up').value,amount:Number($('#lead-detail-amount').value||0),note:$('#lead-detail-note').value.trim()};
  if(!changes.phone||!changes.email){toast('La consulta debe conservar el teléfono y el correo electrónico.');return;}
  const submitter=event.submitter;submitter.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'update_lead',leadId:lead.id,...changes});await enterProduction();}
    else{
      Object.assign(lead,{phone:changes.phone,email:changes.email,status:changes.status,nextAction:changes.nextAction,followUp:changes.followUp,amount:changes.amount,updatedAt:new Date().toISOString()});
      if(changes.note)lead.notes.push({id:crypto.randomUUID(),body:changes.note,at:new Date().toISOString()});
      log('lead_updated','crm_lead',lead.id,{status:changes.status});saveState();
    }
    $('#lead-detail-dialog').close();renderShell();toast('Consulta actualizada.');
  }catch{toast('No se ha podido actualizar la consulta.');}
  finally{submitter.disabled=false;}
});
$('#convert-lead').addEventListener('click',async()=>{
  const lead=state.leads.find(item=>item.id===$('#lead-detail-id').value);if(!lead)return;
  const button=$('#convert-lead');button.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'convert_lead',leadId:lead.id});await enterProduction();}
    else{
      const caseId=crypto.randomUUID();
      const clientId=`lead-client-${lead.id}`;
      state.cases.unshift({id:caseId,reference:`RS-${new Date().getFullYear()}-${String(state.cases.length+1).padStart(4,'0')}`,clientId,client:lead.name,title:lead.summary.slice(0,100),category:lead.category,statusCode:'open',status:'Abierto',stage:0,openedAt:new Date().toISOString(),clientNextStep:'',professionalName:'',professionalTitle:'',professionalRegistration:'',professionalRegion:lead.province});
      state.events.push({id:crypto.randomUUID(),caseId,kind:'open',title:'Expediente abierto',description:'La consulta ha sido aceptada y convertida en expediente.',at:new Date().toISOString(),current:true});
      lead.status='won';lead.updatedAt=new Date().toISOString();activeCaseId=caseId;
      log('lead_converted','crm_lead',lead.id,{caseId});saveState();
    }
    $('#lead-detail-dialog').close();activeSection='cases';renderShell();toast('Consulta convertida en expediente.');
  }catch(error){toast(error?.code==='EMAIL_REQUIRED_FOR_PORTAL'?'Añade un correo electrónico antes de crear el acceso del cliente.':'No se ha podido convertir la consulta.');}
  finally{button.disabled=false;}
});
$('#task-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#task-dialog').close();return;}
  const payload={title:$('#task-title').value.trim(),dueDate:$('#task-date').value,priority:$('#task-priority').value,leadId:$('#task-lead').value};
  const submitter=event.submitter;submitter.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'create_task',...payload});await enterProduction();}
    else{const id=crypto.randomUUID();state.tasks.push({id,...payload,completed:false,createdAt:new Date().toISOString()});log('task_created','crm_task',id);saveState();}
    $('#task-form').reset();$('#task-dialog').close();activeSection='tasks';renderShell();toast('Tarea registrada.');
  }catch{toast('No se ha podido registrar la tarea.');}
  finally{submitter.disabled=false;}
});
$('#password-form').addEventListener('submit',async event=>{
  event.preventDefault();const password=$('#new-password').value,confirmation=$('#confirm-password').value;
  if(password!==confirmation){toast('Las contraseñas no coinciden.');return;}
  const submitter=event.submitter;submitter.disabled=true;
  try{await platformApi.updatePassword(password);$('#password-form').reset();$('#password-dialog').close();await enterProduction();toast('Acceso confirmado correctamente.');}
  catch(error){toast(error?.code==='WEAK_PASSWORD'?'La contraseña debe tener al menos 12 caracteres.':'No se ha podido confirmar el acceso.');}
  finally{submitter.disabled=false;}
});
$('#password-dialog').addEventListener('cancel',event=>event.preventDefault());
$('#mfa-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const code=$('#mfa-code').value.trim();
  const submitter=event.submitter;submitter.disabled=true;
  try{
    const challenge=await platformApi.challengeMfa(mfaFactorId);
    await platformApi.verifyMfa(mfaFactorId,challenge.id,code);
    $('#mfa-form').reset();$('#mfa-dialog').close();
    await enterProduction();
    toast(mfaEnrollment?'Segundo factor activado correctamente.':'Identidad confirmada correctamente.');
  }catch(error){
    toast(error?.code==='INVALID_MFA_CODE'?'Introduce un código válido de tu app de autenticación.':'No se ha podido verificar el segundo factor.');
  }finally{submitter.disabled=false;}
});
$('#mfa-logout').addEventListener('click',logout);
$('#mfa-dialog').addEventListener('cancel',event=>event.preventDefault());
$('#notification-button').addEventListener('click',()=>{activeSection='notifications';renderShell();});

if(productionMode){
  $('.test-banner').hidden=true;$('.demo-access').hidden=!runtimeConfig.allowDemoAccess;
  if(platformApi){
    const callbackType=platformApi.consumeUrlSession(location.href);
    if(platformApi.requiresPasswordSetup(callbackType)){
      $('#password-dialog').showModal();
      requestAnimationFrame(()=>$('#new-password').focus());
    }else enterProduction().catch(()=>{});
  }
}else if(state.activeRole)enter(state.activeRole);

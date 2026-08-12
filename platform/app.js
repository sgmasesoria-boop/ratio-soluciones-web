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
  catch (error) { console.error('Configuración de plataforma no válida', error); }
}

const now = new Date();
const iso = (minutesAgo = 0) => new Date(now.getTime() - minutesAgo * 60000).toISOString();
const statusLabels = { open:'Abierto', not_contracted:'No contratado', archived:'Archivado' };
const leadStatusLabels = { new:'Nueva', review:'En estudio', waiting:'Falta información', viable:'Viable', proposal:'Propuesta enviada', contract:'Contrato pendiente', won:'Contratada', lost:'No viable / cerrada' };
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
    client: { id:'usr_client_01', name:'Carlos Martín', initials:'CM', role:'Cliente' },
    admin: { id:'usr_admin_01', name:'Sergio Guerrero', initials:'SG', role:'Gestor' }
  },
  cases: [
    {
      id:'case_01', reference:'RS-2048', clientId:'usr_client_01', client:'Carlos Martín',
      title:'Revisión de financiación', category:'Banca y financiación', statusCode:'open',
      status:'Abierto', manualPhase:'Revisión de la financiación', portalStatus:'active', contractConfirmedAt:iso(4300), openedAt:iso(4320),
      clientNextStep:'No tienes que hacer nada ahora. Te avisaremos cuando exista una novedad o necesitemos una decisión.',
      professionalName:'Laura Fernández Ruiz', professionalTitle:'Letrada responsable',
      professionalRegistration:'ICAGR n.º 0000 · dato ficticio', professionalRegion:'Andalucía'
    },
    {
      id:'case_02', reference:'RS-2051', clientId:'usr_client_02', client:'Ana Romero',
      title:'Incidencia en comunidad de propietarios', category:'Vivienda', statusCode:'open',
      status:'Abierto', manualPhase:'Comprobación de antecedentes', portalStatus:'active', contractConfirmedAt:iso(7180), openedAt:iso(7200),
      clientNextStep:'Estamos comprobando la información inicial. Te avisaremos si necesitamos alguna aclaración.',
      professionalName:'Miguel Torres Sánchez', professionalTitle:'Profesional responsable',
      professionalRegistration:'Dato profesional ficticio', professionalRegion:'Madrid'
    },
    {
      id:'case_03', reference:'RS-2056', clientId:'usr_client_03', client:'Ada Navarro',
      title:'Reclamación de indemnización', category:'Seguros e indemnizaciones', statusCode:'open',
      status:'Abierto', manualPhase:'Respuesta recibida, pendiente de valoración', portalStatus:'active', contractConfirmedAt:iso(10060), openedAt:iso(10080),
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
  documentRequests: [
    {id:'req_01',caseId:'case_01',requestType:'document',title:'Contrato de la tarjeta',instructions:'Sube el contrato o la copia más completa que tengas.',status:'pending',responseText:'',responseAt:'',requestedAt:iso(60)}
  ],
  caseDocuments: [],
  communicationRequests: [
    {id:'com_01',caseId:'case_01',requestedBy:'usr_client_01',subject:'Quiero aclarar el siguiente paso',message:'Necesito confirmar si debo conservar los recibos nuevos.',deadlineContext:'No tengo ninguna notificación con plazo.',availabilityNote:'Preferiblemente por la tarde.',responseText:'Conserva los recibos. No necesitas enviarlos hasta que te lo pidamos desde la plataforma.',respondedAt:iso(30),createdAt:iso(90)}
  ],
  workingDocuments: [],
  documentVersions: [],
  contracts: [],
  leads: [
    { id:'lead_01', reference:'C-2026-001', name:'María López', phone:'600 000 001', email:'maria@example.es', province:'Granada', category:'Banca y financiación', source:'Formulario web', summary:'Consulta sobre una tarjeta revolving cuya deuda no disminuye.', status:'review', amount:650, privacyNoticeAt:iso(1440), legalBasis:'precontractual_request', createdAt:iso(1440), updatedAt:iso(120), notes:[{id:'note_01',body:'Contacto inicial realizado. Pendiente de comprobación de viabilidad.',at:iso(120)}] },
    { id:'lead_02', reference:'C-2026-002', name:'Antonio Ruiz', phone:'600 000 002', email:'antonio@example.es', province:'Madrid', category:'Vivienda', source:'Recomendación', summary:'Necesita orientación ante un conflicto en su comunidad de propietarios.', status:'new', amount:0, privacyNoticeAt:iso(240), legalBasis:'precontractual_request', createdAt:iso(240), updatedAt:iso(240), notes:[] }
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
    return { ...structuredClone(seed), ...stored, cases:[...storedCases,...structuredClone(newDemoCases)], events:[...storedEvents,...structuredClone(newDemoEvents)], leads, tasks:stored.tasks || [], documentRequests:stored.documentRequests || structuredClone(seed.documentRequests), caseDocuments:stored.caseDocuments || [], communicationRequests:stored.communicationRequests||structuredClone(seed.communicationRequests), workingDocuments:stored.workingDocuments||[], documentVersions:stored.documentVersions||[], contracts:stored.contracts||[], audit:stored.audit || [] };
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
    status:item.manual_phase || statusLabels[item.status] || item.status,
    openedAt:item.opened_at, clientNextStep:item.client_next_step || '',
    phone:item.contact_phone || '', email:item.contact_email || '', province:item.contact_province || '', source:item.source || '',
    manualPhase:item.manual_phase || '', portalStatus:item.portal_status || 'disabled', contractConfirmedAt:item.contract_confirmed_at || '',
    amount:Number(item.quoted_amount || 0), privacyNoticeAt:item.privacy_notice_at || '', legalBasis:item.legal_basis || 'precontractual_request',
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
    leads:[],
    tasks:(workspace.tasks || []).map(item => ({ id:item.id, caseId:item.case_id, title:item.title, dueDate:item.due_on, priority:item.priority, completed:Boolean(item.completed_at), createdAt:item.created_at })),
    documentRequests:(workspace.documentRequests || []).map(item => ({id:item.id,caseId:item.case_id,requestType:item.request_type||'document',title:item.title,instructions:item.instructions||'',status:item.status,responseText:item.response_text||'',responseAt:item.response_at||'',requestedBy:item.requested_by,requestedAt:item.requested_at,fulfilledAt:item.fulfilled_at||''})),
    caseDocuments:(workspace.caseDocuments || []).map(item => ({id:item.id,caseId:item.case_id,requestId:item.request_id,originalName:item.original_name,mimeType:item.mime_type,sizeBytes:Number(item.size_bytes||0),status:item.status,uploadedBy:item.uploaded_by,privacyNoticeAt:item.privacy_notice_at,createdAt:item.created_at,reviewedAt:item.reviewed_at||''})),
    communicationRequests:(workspace.communicationRequests||[]).map(item=>({id:item.id,caseId:item.case_id,requestedBy:item.requested_by,subject:item.subject,message:item.message,deadlineContext:item.deadline_context||'',availabilityNote:item.availability_note||'',responseText:item.response_text||'',respondedBy:item.responded_by||'',respondedAt:item.responded_at||'',createdAt:item.created_at})),
    workingDocuments:(workspace.workingDocuments||[]).map(item=>({id:item.id,caseId:item.case_id,title:item.title,documentType:item.document_type||'',statusLabel:item.current_status_label||'',visibility:item.visibility,publishedAt:item.published_at||'',createdAt:item.created_at,updatedAt:item.updated_at})),
    documentVersions:(workspace.documentVersions||[]).map(item=>({id:item.id,documentId:item.working_document_id,versionNumber:item.version_number,statusLabel:item.status_label||'',changeSummary:item.change_summary||'',draftContent:item.draft_content||'',originalName:item.original_name||'',mimeType:item.mime_type||'',sizeBytes:Number(item.size_bytes||0),sourceAiRunId:item.source_ai_run_id||'',createdAt:item.created_at})),
    contracts:(workspace.contracts||[]).map(item=>({id:item.id,caseId:item.case_id,templateKey:item.template_key,templateVersion:Number(item.template_version||1),contractNote:item.contract_note||'',signerFullName:item.signer_full_name,signerIdentifier:item.signer_identifier,signerAddress:item.signer_address,cause:item.cause,workScope:item.work_scope,priceAmount:Number(item.price_amount||0),currency:item.currency||'EUR',provider:item.provider||'',providerRequestId:item.provider_request_id||'',providerDocumentId:item.provider_document_id||'',unsignedStoragePath:item.unsigned_storage_path||'',unsignedSha256:item.unsigned_sha256||'',sentAt:item.sent_at||'',signedAt:item.signed_at||'',invalidatedAt:item.invalidated_at||'',createdAt:item.created_at,updatedAt:item.updated_at})),
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
    const appLink = $('#mfa-open-app');
    const uri = String(enrolled.totp?.uri || '');
    appLink.hidden = !uri.startsWith('otpauth://');
    if (!appLink.hidden) appLink.href = uri;
    else appLink.removeAttribute('href');
  }
  if (!$('#mfa-dialog').open) $('#mfa-dialog').showModal();
  requestAnimationFrame(() => $('#mfa-code').focus());
}

function mfaQrSource(value) {
  const qr = String(value || '').replace(/^\uFEFF/, '').trim();
  if (/^data:image\/svg\+xml[^,]*;base64,/i.test(qr)) return qr;
  if (/^data:image\/svg\+xml[^,]*,/i.test(qr)) {
    const payload = qr.slice(qr.indexOf(',') + 1);
    try { return mfaSvgDataUrl(decodeURIComponent(payload)); }
    catch { return mfaSvgDataUrl(payload); }
  }
  if (/%3Csvg[\s%>]/i.test(qr)) {
    try { return mfaSvgDataUrl(decodeURIComponent(qr)); }
    catch { return ''; }
  }
  if (qr.includes('<svg')) return mfaSvgDataUrl(qr);
  return '';
}

function mfaSvgDataUrl(value) {
  const svg = String(value || '');
  const start = svg.indexOf('<svg');
  if (start < 0) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.slice(start))}`;
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
    ? [['overview','Resumen'],['cases','Expedientes'],['tasks','Agenda'],['finance','Control económico'],['notifications','Avisos'],['audit','Registro de actividad']]
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
    $('#main').innerHTML = `${pageHead(c.reference,c.title,'Consulta cada actuación registrada en tu expediente.')}
      <div class="case-layout"><section class="panel"><div class="panel-head"><h2>Historial del expediente</h2><small>Orden cronológico</small></div>${timeline()}</section><aside>${nextStepCard(c)}${professionalCard(c)}</aside></div>${communicationPanel(c,false)}${caseDocumentsPanel(c,false)}`;
  } else if (activeSection === 'timeline') {
    $('#main').innerHTML = `${pageHead('Cronología','Cada actuación, en orden','El historial muestra hechos ya registrados. No incluye fechas estimadas de resolución.')}<section class="panel">${timeline(true)}</section>`;
  } else if (activeSection === 'notifications') {
    markNotificationsRead();
    $('#main').innerHTML = `${pageHead('Avisos','Novedades de tu caso','Los avisos te indican cuándo existe un avance o necesitamos una decisión.')}<section class="panel"><div class="notification-list">${notificationList()}</div></section>`;
  } else {
    $('#main').innerHTML = `${pageHead('Seguridad','Tu acceso','Controla tu sesión y protege el acceso al expediente.')}<div class="case-layout"><section class="panel"><div class="panel-head"><h2>Doble factor de autenticación</h2><span class="status-pill">Obligatorio para el equipo</span></div><p class="panel-copy">Las cuentas internas no podrán utilizarse con clientes reales hasta que el doble factor esté activado y verificado en el proveedor de identidad.</p></section><section class="panel"><div class="panel-head"><h2>Privacidad del portal</h2></div><p class="panel-copy">La documentación se entrega únicamente cuando Ratio la solicita. Cada archivo queda vinculado al expediente, con acceso privado y registro de actividad.</p></section></div>`;
  }
  bindDocumentActions();
  bindCommunicationActions();
}

function renderAdmin() {
  const c = state.cases.find(item => item.id === activeCaseId) || null;
  const activeCases = state.cases.filter(item => item.statusCode==='open').length;
  const pendingTasks = state.tasks.filter(item => !item.completed).length;
  const portalCases=state.cases.filter(item=>['invited','active'].includes(item.portalStatus)).length;
  const pipelineAmount = state.cases.filter(item=>item.statusCode==='open').reduce((total,item)=>total+Number(item.amount||0),0);
  if (activeSection === 'overview') {
    $('#main').innerHTML = `${pageHead('Gestión interna','Resumen operativo','Un único expediente desde el primer contacto, con acceso del cliente separado.','<button class="primary-button" id="new-lead">Nuevo expediente <span>→</span></button>')}
      <div class="metric-grid"><div class="metric"><small>Expedientes activos</small><strong>${activeCases}</strong><span>Incluye estudios iniciales</span></div><div class="metric"><small>Tareas pendientes</small><strong>${pendingTasks}</strong><span>Agenda interna</span></div><div class="metric"><small>Portales habilitados</small><strong>${portalCases}</strong><span>Tras contratación</span></div><div class="metric"><small>Presupuestado</small><strong>${formatMoney(pipelineAmount)}</strong><span>Expedientes abiertos</span></div></div>
      <div class="admin-grid"><section class="panel"><div class="panel-head"><h2>Últimos expedientes</h2><small>${activeCases} abiertos</small></div>${caseTable(state.cases.filter(item=>item.statusCode==='open').slice(0,6))}</section><section class="panel"><div class="panel-head"><h2>Próximas actuaciones</h2><small>Uso interno</small></div>${taskList(state.tasks.filter(item=>!item.completed).slice(0,6))}</section></div>`;
    bindCrmActions();
  } else if (activeSection === 'leads') {
    const visibleLeads=filteredLeads();
    $('#main').innerHTML = `${pageHead('CRM','Consultas y oportunidades','Cada contacto conserva su origen, consentimiento, estado y un historial cronológico de notas.','<button class="primary-button" id="new-lead">Registrar consulta <span>→</span></button>')}<section class="panel"><div class="lead-filters"><label for="lead-status-filter">Mostrar consultas</label><select id="lead-status-filter"><option value="active" ${leadFilter==='active'?'selected':''}>Activas</option><option value="new" ${leadFilter==='new'?'selected':''}>Nuevas</option><option value="review" ${leadFilter==='review'?'selected':''}>En estudio</option><option value="waiting" ${leadFilter==='waiting'?'selected':''}>Falta información</option><option value="viable" ${leadFilter==='viable'?'selected':''}>Viables</option><option value="proposal" ${leadFilter==='proposal'?'selected':''}>Propuesta enviada</option><option value="contract" ${leadFilter==='contract'?'selected':''}>Contrato pendiente</option><option value="won" ${leadFilter==='won'?'selected':''}>Contratadas</option><option value="lost" ${leadFilter==='lost'?'selected':''}>No viables / cerradas</option><option value="all" ${leadFilter==='all'?'selected':''}>Todas</option></select><small>${visibleLeads.length} ${visibleLeads.length===1?'consulta':'consultas'}</small></div><div class="pipeline-board">${leadPipeline(visibleLeads)}</div></section>`;
    bindCrmActions();
  } else if (activeSection === 'tasks') {
    $('#main').innerHTML = `${pageHead('Agenda interna','Próximas actuaciones','Las fechas son recordatorios internos y nunca se muestran como promesas al cliente.','<button class="primary-button" id="new-task">Nueva tarea <span>→</span></button>')}<section class="panel">${taskList(state.tasks)}</section>`;
    bindCrmActions();
  } else if (activeSection === 'cases') {
    if (!state.cases.length) {
      $('#main').innerHTML = `${pageHead('Expedientes','Todavía no hay expedientes','El primer contacto aparecerá aquí directamente.','<button class="primary-button" id="new-lead">Nuevo expediente <span>→</span></button>')}<section class="panel"><div class="empty">No hay expedientes disponibles.</div></section>`;
      bindCrmActions();
    } else if (!c) {
      const visibleCases=filteredCases();
      $('#main').innerHTML = `${pageHead('Expedientes','Expedientes activos','La situación se escribe libremente en cada ficha. Los cerrados solo aparecen al buscarlos o filtrarlos.','<button class="primary-button" id="new-lead">Nuevo expediente <span>→</span></button>')}<section class="panel"><div class="case-tools"><div class="case-search"><label for="case-search">Buscar expediente</label><input id="case-search" type="search" value="${escapeHtml(caseSearch)}" placeholder="Nombre, teléfono, correo, referencia, asunto…" autocomplete="off"><small>La búsqueda revisa todos los campos e incluye expedientes cerrados.</small></div><div class="case-filter"><label for="case-status-filter">Mostrar</label><select id="case-status-filter"><option value="active" ${caseFilter==='active'?'selected':''}>Solo activos</option><option value="closed" ${caseFilter==='closed'?'selected':''}>Solo cerrados</option><option value="all" ${caseFilter==='all'?'selected':''}>Todos</option></select></div></div><div class="panel-head"><h2>Listado de expedientes</h2><small id="case-count">${visibleCases.length} ${visibleCases.length===1?'expediente':'expedientes'}</small></div><div id="case-results">${caseTable(visibleCases)}</div></section>`;
      bindCrmActions();
      bindCaseListControls();
    } else {
      const signedContract=(state.contracts||[]).find(item=>item.caseId===c.id&&item.signedAt&&!item.invalidatedAt);
      const portalAction=['invited','active'].includes(c.portalStatus)?'<button class="secondary-button" id="resend-case-confirmation">Reenviar acceso</button>':signedContract?'<button class="secondary-button" id="activate-case-portal">Activar portal</button>':'';
      const requestAction=['invited','active'].includes(c.portalStatus)?'<button class="secondary-button" id="request-document">Solicitar al cliente</button>':'';
      $('#main').innerHTML = `${pageHead('Expedientes',c.reference+' · '+c.client,c.title,`<button class="secondary-button" id="back-to-cases">← Todos los expedientes</button><button class="secondary-button" id="edit-case-record">Editar ficha</button>${portalAction}${requestAction}<button class="primary-button" id="new-update">Registrar avance →</button>`)}<div class="case-layout"><section class="panel"><div class="panel-head"><h2>Cronología única</h2><span class="status-pill">${escapeHtml(c.manualPhase||statusLabels[c.statusCode]||'Sin indicación')}</span></div>${timeline(true)}</section><aside>${portalAccessCard(c)}${nextStepCard(c)}${professionalCard(c)}</aside></div>${communicationPanel(c,true)}${contractPanel(c)}${caseAiPanel()}${workingDocumentsPanel(c)}${caseDocumentsPanel(c,true)}`;
      $('#back-to-cases').addEventListener('click',()=>{activeCaseId=null;renderShell();});
      $('#new-update').addEventListener('click',openUpdateDialog);
      $('#request-document')?.addEventListener('click',openDocumentRequestDialog);
      $('#analyze-case-ai')?.addEventListener('click',()=>analyzeCurrentCase(c));
      $('#test-document-ai')?.addEventListener('click',testSyntheticDocumentPipeline);
      bindDocumentActions();
      bindCommunicationActions();
    }
  } else if (activeSection === 'finance') {
    const contracted=state.cases.filter(item=>['invited','active'].includes(item.portalStatus));
    $('#main').innerHTML = `${pageHead('Control económico','Contrataciones e importes','Resumen interno basado en expedientes, sin embudos comerciales predefinidos.')}<div class="metric-grid"><div class="metric"><small>Contrataciones</small><strong>${contracted.length}</strong><span>Portales habilitados</span></div><div class="metric"><small>Importe contratado</small><strong>${formatMoney(contracted.reduce((t,i)=>t+Number(i.amount||0),0))}</strong><span>Importe presupuestado</span></div><div class="metric"><small>Expedientes abiertos</small><strong>${activeCases}</strong><span>En cualquier situación</span></div><div class="metric"><small>Liquidaciones</small><strong>—</strong><span>Fase posterior</span></div></div><section class="panel">${caseTable(state.cases.filter(i=>i.amount>0))}</section>`;
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
  return `<table class="case-table"><thead><tr><th>Referencia</th><th>Contacto</th><th>Área</th><th>Estado</th><th>Último movimiento</th></tr></thead><tbody>${list.map(item=>`<tr tabindex="0" data-lead-id="${escapeHtml(item.id)}"><td class="case-ref">${escapeHtml(item.reference)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.category)}</td><td><span class="lead-status status-${escapeHtml(item.status)}">${escapeHtml(leadStatusLabels[item.status]||item.status)}</span></td><td>${escapeHtml(formatDate(item.updatedAt||item.createdAt))}</td></tr>`).join('')}</tbody></table>`;
}
function filteredLeads() {
  if(leadFilter==='active')return state.leads.filter(item=>!['won','lost'].includes(item.status));
  if(leadFilter==='all')return state.leads;
  return state.leads.filter(item=>item.status===leadFilter);
}
function leadPipeline(list=filteredLeads()) {
  const groups=[['new','Nuevas'],['review','En estudio'],['waiting','Falta información'],['viable','Viables'],['proposal','Propuesta'],['contract','Contrato'],['won','Contratadas'],['lost','Cerradas']];
  const visibleStatuses=leadFilter==='active'?groups.filter(([status])=>!['won','lost'].includes(status)):leadFilter==='all'?groups:groups.filter(([status])=>status===leadFilter);
  return visibleStatuses.map(([status,label])=>{const grouped=list.filter(item=>item.status===status);return `<section class="pipeline-column"><header><strong>${label}</strong><span>${grouped.length}</span></header>${grouped.map(item=>{const latestNote=item.notes?.at(-1)?.body||'Sin notas internas';return `<button type="button" class="lead-card" data-lead-id="${escapeHtml(item.id)}"><small>${escapeHtml(item.reference)} · ${escapeHtml(item.province||'Sin provincia')}</small><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)}</p><em>${escapeHtml(latestNote)}</em></button>`;}).join('')||'<p class="pipeline-empty">Sin consultas</p>'}</section>`;}).join('');
}
function taskList(list=state.tasks) {
  if (!list.length) return '<div class="empty">No hay tareas pendientes.</div>';
  return `<div class="task-list">${[...list].sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate))).map(task=>{const caseItem=state.cases.find(item=>item.id===task.caseId);return `<article class="task-row ${task.completed?'completed':''}"><button type="button" class="task-check" data-task-id="${escapeHtml(task.id)}" aria-label="${task.completed?'Reabrir':'Completar'} tarea">${task.completed?'✓':''}</button><div><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(caseItem?caseItem.client+' · '+caseItem.reference:'Sin expediente asociado')}</p></div><time class="${task.priority==='high'?'priority-high':''}">${escapeHtml(formatShortDate(task.dueDate))}</time></article>`;}).join('')}</div>`;
}
function formatShortDate(value) { if(!value)return ''; return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)); }
function leadHistoryEntries(lead) {
  const initialEntry={id:`initial-${lead.id}`,type:'consultation',label:'Consulta',title:'Consulta recibida',body:lead.summary,at:lead.createdAt};
  const consultationEntries=(lead.notes||[]).map(note=>({
    id:note.id,type:'consultation',label:'Consulta',title:note.authorName||'Equipo Ratio',body:note.body,at:note.at
  }));
  const caseEntries=lead.convertedCaseId?state.events.filter(event=>event.caseId===lead.convertedCaseId).map(event=>({
    id:event.id,type:'case',label:'Expediente',title:event.title,body:event.description&&event.description!==event.title?event.description:'',at:event.at
  })):[];
  return [initialEntry,...consultationEntries,...caseEntries].sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function leadHistory(lead) {
  const entries=leadHistoryEntries(lead);
  if(!entries.length)return '<div class="empty lead-history-empty">Todavía no hay movimientos. El próximo cambio quedará registrado aquí automáticamente.</div>';
  return `<div class="lead-history-timeline">${entries.map(entry=>`<article class="history-${escapeHtml(entry.type)}"><time>${escapeHtml(formatDate(entry.at))}</time><div><span class="history-source">${escapeHtml(entry.label)}</span><strong>${escapeHtml(entry.title)}</strong>${entry.body?`<p>${escapeHtml(entry.body)}</p>`:''}</div></article>`).join('')}</div>`;
}
function caseConsultationHistory(caseItem) {
  const leads=state.leads.filter(lead=>lead.convertedCaseId===caseItem.id);
  if(!leads.length)return '';
  const count=leads.reduce((total,lead)=>total+leadHistoryEntries(lead).length,0);
  return `<section class="panel case-consultation-history"><div class="panel-head"><div><p class="kicker">Uso interno</p><h2>Historial cronológico completo</h2><p>Consulta inicial y anotaciones del expediente, claramente diferenciadas.</p></div><small>${count} ${count===1?'movimiento':'movimientos'}</small></div>${leads.map(lead=>`<div class="consultation-origin"><strong>${escapeHtml(lead.reference)} · ${escapeHtml(lead.name)}</strong><p>${escapeHtml(lead.summary)}</p></div>${leadHistory(lead)}`).join('')}</section>`;
}

function timeline(full=false) {
  const events=state.events.filter(e=>e.caseId===currentCase().id).sort((a,b)=>new Date(a.at)-new Date(b.at));
  return `<div class="timeline">${events.map((e,i)=>{const detail=e.description&&e.description!==e.title?`<p>${escapeHtml(e.description)}</p>`:'';return `<article class="event ${e.current?'current':''}"><span class="event-mark">${e.done?'✓':String(i+1).padStart(2,'0')}</span><div class="event-body"><small>${formatDate(e.at)} · ${e.done?'Registrado':e.current?'Último avance':'Avance'}</small><strong>${escapeHtml(e.title)}</strong>${detail}</div></article>`;}).join('')}${full?'<article class="event"><span class="event-mark">—</span><div class="event-body"><small>Siguiente avance</small><strong>Se añadirá cuando ocurra</strong><p>No mostramos fechas previstas que todavía no pueden confirmarse.</p></div></article>':''}</div>`;
}
function nextStepCard(c) {
  const pending=state.documentRequests.filter(item=>item.caseId===c.id&&item.status==='pending');
  const isClient=state.activeRole==='client';
  const content=pending.length?`<div class="client-action-list">${pending.map(request=>{
    const typeLabel=request.requestType==='clarification'?'Aclaración':'Documentación';
    const action=isClient?(request.requestType==='clarification'
      ?`<button type="button" class="secondary-button" data-respond-request="${escapeHtml(request.id)}">Responder aclaración</button>`
      :`<button type="button" class="secondary-button" data-upload-request="${escapeHtml(request.id)}">Entregar archivo</button>`):'';
    return `<article class="client-action"><small>${escapeHtml(typeLabel)}</small><strong>${escapeHtml(request.title)}</strong>${request.instructions?`<p>${escapeHtml(request.instructions)}</p>`:''}${action}</article>`;
  }).join('')}</div>`:'<p><strong>Por ahora, nada.</strong></p><p>Te avisaremos cuando necesitemos documentación, una aclaración o una decisión.</p>';
  return `<section class="panel next-step-card"><div class="panel-head"><h2>Qué necesitamos de ti</h2><small>${pending.length?`${pending.length} pendiente${pending.length===1?'':'s'}`:'Sin peticiones pendientes'}</small></div>${content}</section>`;
}
function professionalCard(c) {
  const assigned=Boolean(c.professionalName);
  return `<section class="panel professional-card"><div class="panel-head"><h2>Profesional asignado</h2><small>${assigned?'Identificado':'Pendiente'}</small></div>${assigned?`<div class="professional-profile"><span>${escapeHtml(initials(c.professionalName))}</span><div><strong>${escapeHtml(c.professionalName)}</strong><p>${escapeHtml(c.professionalTitle || 'Profesional responsable')}</p><small>${escapeHtml([c.professionalRegistration,c.professionalRegion].filter(Boolean).join(' · '))}</small></div></div><p class="professional-channel-note">Ratio coordina las comunicaciones ordinarias desde este portal. Cuando el asunto requiera hablar directamente con el profesional, organizaremos el contacto.</p>`:'<p class="panel-copy">Te informaremos de su identidad y acreditación cuando se asigne la intervención.</p>'}</section>`;
}

function communicationPanel(caseItem,isAdmin){
  const requests=(state.communicationRequests||[]).filter(item=>item.caseId===caseItem.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const items=requests.length?requests.map(item=>`<article class="communication-item"><div class="communication-head"><div><small>${escapeHtml(formatDate(item.createdAt))}</small><strong>${escapeHtml(item.subject)}</strong></div>${item.respondedAt?'<span class="status-pill">Respondida</span>':'<span class="status-pill">Pendiente de respuesta</span>'}</div><p>${escapeHtml(item.message)}</p>${item.deadlineContext?`<div class="communication-context"><small>Notificación o plazo indicado</small><p>${escapeHtml(item.deadlineContext)}</p></div>`:''}${item.availabilityNote?`<div class="communication-context"><small>Disponibilidad orientativa</small><p>${escapeHtml(item.availabilityNote)}</p></div>`:''}${item.responseText?`<div class="clarification-response"><small>Respuesta de Ratio · ${escapeHtml(formatDate(item.respondedAt))}</small><p>${escapeHtml(item.responseText)}</p></div>`:isAdmin?`<button type="button" class="secondary-button" data-respond-communication="${escapeHtml(item.id)}">Responder desde Ratio</button>`:''}</article>`).join(''):'<div class="empty">Todavía no hay solicitudes de comunicación.</div>';
  const action=!isAdmin&&caseItem.statusCode==='open'?'<button type="button" class="primary-button" id="request-communication">Solicitar aclaración o llamada →</button>':'';
  return `<section class="panel communication-panel"><div class="panel-head"><div><p class="kicker">Canal ordinario</p><h2>Hablar sobre tu expediente</h2><p>Escribe aquí tu consulta. Ratio la revisará y coordinará la respuesta o el contacto con el profesional cuando sea necesario.</p></div>${action}</div><div class="communication-notice"><strong>Si tienes una notificación, cita o plazo, indícalo expresamente.</strong><span>El portal deja constancia, pero no sustituye los canales de urgencia que se te hayan comunicado para tu asunto.</span></div><div class="communication-list">${items}</div></section>`;
}

function openCommunicationDialog(){
  const c=currentCase();if(!c)return;
  $('#communication-form').reset();$('#communication-case').value=c.id;setModalFeedback('#communication-feedback');$('#communication-dialog').showModal();
}
function openCommunicationResponseDialog(id){
  const item=(state.communicationRequests||[]).find(record=>record.id===id);if(!item)return;
  $('#communication-response-form').reset();$('#communication-response-id').value=id;$('#communication-response-subject').textContent=item.subject;setModalFeedback('#communication-response-feedback');$('#communication-response-dialog').showModal();
}
function bindCommunicationActions(){
  $('#request-communication')?.addEventListener('click',openCommunicationDialog);
  $$('[data-respond-communication]').forEach(button=>button.addEventListener('click',()=>openCommunicationResponseDialog(button.dataset.respondCommunication)));
}
function normalizeSearch(value) {
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function formatFileSize(bytes) {
  const size=Number(bytes||0);
  return size>=1048576?`${(size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(size/1024))} KB`;
}
function caseDocumentsPanel(caseItem,isAdmin) {
  const requests=state.documentRequests.filter(item=>item.caseId===caseItem.id);
  const documents=state.caseDocuments.filter(item=>item.caseId===caseItem.id);
  const statusText={pending:'Pendiente de entrega',submitted:'Entregada · pendiente de revisión',accepted:'Revisada',cancelled:'Cancelada',uploaded:'Recibido',rejected:'Rechazado'};
  const content=requests.length?requests.map(request=>{
    const files=documents.filter(document=>document.requestId===request.id);
    const fileList=files.length?`<ul class="document-list">${files.map(document=>`<li><span>${document.mimeType==='application/pdf'?'PDF':'IMG'}</span><div><strong>${escapeHtml(document.originalName)}</strong><small>${escapeHtml(formatFileSize(document.sizeBytes))} · ${escapeHtml(formatDate(document.createdAt))}</small></div><div class="document-actions"><em>${escapeHtml(statusText[document.status]||document.status)}</em><button type="button" class="document-download" data-download-document="${escapeHtml(document.id)}">Descargar</button>${isAdmin&&document.status==='uploaded'?`<button type="button" class="document-download" data-review-document="${escapeHtml(document.id)}" data-review-status="accepted">Validar</button>`:''}</div></li>`).join('')}</ul>`:'<p class="document-empty">Todavía no se ha entregado ningún archivo.</p>';
    if(request.requestType==='clarification'){
      const clarificationStatus={pending:'Pendiente de respuesta',submitted:'Respondida',accepted:'Revisada',cancelled:'Cancelada'};
      const response=request.responseText?`<div class="clarification-response"><small>Respuesta del cliente${request.responseAt?` · ${escapeHtml(formatDate(request.responseAt))}`:''}</small><p>${escapeHtml(request.responseText)}</p></div>`:'<p class="document-empty">Todavía no se ha recibido la aclaración.</p>';
      const adminAction=isAdmin&&request.status==='pending'?`<button type="button" class="document-download" data-cancel-request="${escapeHtml(request.id)}">Retirar solicitud</button>`:'';
      return `<article class="document-request"><div class="document-request-head"><div><span class="history-source">Aclaración · ${escapeHtml(clarificationStatus[request.status]||request.status)}</span><h3>${escapeHtml(request.title)}</h3></div>${adminAction}</div>${request.instructions?`<p>${escapeHtml(request.instructions)}</p>`:''}${response}</article>`;
    }
    const adminAction=isAdmin&&request.status==='pending'?`<button type="button" class="document-download" data-cancel-request="${escapeHtml(request.id)}">Retirar solicitud</button>`:'';
    return `<article class="document-request"><div class="document-request-head"><div><span class="history-source">Documentación · ${escapeHtml(statusText[request.status]||request.status)}</span><h3>${escapeHtml(request.title)}</h3></div>${adminAction}</div>${request.instructions?`<p>${escapeHtml(request.instructions)}</p>`:''}${fileList}</article>`;
  }).join(''):'<div class="empty">No hay solicitudes al cliente en este expediente.</div>';
  return `<section class="panel case-documents"><div class="panel-head"><div><p class="kicker">Canal privado</p><h2>Solicitudes y respuestas</h2><p>Las aclaraciones y los archivos permanecen vinculados al expediente y dejan registro cronológico.</p></div><small>${requests.length} ${requests.length===1?'solicitud':'solicitudes'}</small></div>${content}</section>`;
}

function openDocumentRequestDialog() {
  const c=currentCase();
  if(!c)return;
  $('#document-request-case').value=c.id;
  $('#document-request-context').textContent=`${c.reference} · ${c.client}`;
  $('#document-request-form').reset();
  $('#document-request-case').value=c.id;
  $('#document-request-type').value='document';
  setModalFeedback('#document-request-feedback');
  $('#document-request-dialog').showModal();
}
function openDocumentUploadDialog(requestId) {
  const request=state.documentRequests.find(item=>item.id===requestId);
  if(!request)return;
  $('#document-upload-form').reset();
  $('#document-upload-case').value=request.caseId;
  $('#document-upload-request').value=request.id;
  $('#document-upload-title').textContent=request.title;
  $('#document-file-name').textContent='Ningún archivo seleccionado';
  setModalFeedback('#document-upload-feedback');
  $('#document-upload-dialog').showModal();
}
function openClarificationResponseDialog(requestId) {
  const request=state.documentRequests.find(item=>item.id===requestId&&item.requestType==='clarification');
  if(!request)return;
  $('#clarification-response-form').reset();
  $('#clarification-response-case').value=request.caseId;
  $('#clarification-response-request').value=request.id;
  $('#clarification-response-title').textContent=request.title;
  $('#clarification-response-instructions').textContent=request.instructions||'Escribe la aclaración solicitada.';
  setModalFeedback('#clarification-response-feedback');
  $('#clarification-response-dialog').showModal();
}
function bindDocumentActions() {
  $$('[data-upload-request]').forEach(button=>button.addEventListener('click',()=>openDocumentUploadDialog(button.dataset.uploadRequest)));
  $$('[data-respond-request]').forEach(button=>button.addEventListener('click',()=>openClarificationResponseDialog(button.dataset.respondRequest)));
  $$('[data-download-document]').forEach(button=>button.addEventListener('click',()=>downloadDocument(button.dataset.downloadDocument,button)));
  $$('[data-review-document]').forEach(button=>button.addEventListener('click',()=>reviewDocument(button.dataset.reviewDocument,button.dataset.reviewStatus,button)));
  $$('[data-cancel-request]').forEach(button=>button.addEventListener('click',()=>cancelClientRequest(button.dataset.cancelRequest,button)));
}
function caseSearchText(c) {
  return normalizeSearch(Object.values(c).join(' '));
}
function filteredCases() {
  const query=normalizeSearch(caseSearch);
  if(query)return state.cases.filter(c=>caseSearchText(c).includes(query));
  if(caseFilter==='closed')return state.cases.filter(c=>['not_contracted','archived'].includes(c.statusCode));
  if(caseFilter==='all')return state.cases;
  return state.cases.filter(c=>c.statusCode==='open');
}
function caseTable(list=filteredCases()) {
  if(!list.length)return `<div class="empty">${caseSearch?'No hay expedientes que coincidan con la búsqueda.':'No hay expedientes en esta vista.'}</div>`;
  return `<table class="case-table"><thead><tr><th>Referencia</th><th>Persona</th><th>Área</th><th>Situación indicada</th><th>Portal</th></tr></thead><tbody>${list.map(c=>`<tr tabindex="0" data-case-id="${escapeHtml(c.id)}"><td class="case-ref">${escapeHtml(c.reference)}</td><td>${escapeHtml(c.client)}</td><td>${escapeHtml(c.category)}</td><td><span class="status-pill">${escapeHtml(c.manualPhase||'Sin indicación')}</span></td><td>${escapeHtml(portalStatusLabel(c.portalStatus))}</td></tr>`).join('')}</tbody></table>`;
}

function portalStatusLabel(value){return ({disabled:'Sin acceso',invited:'Invitación enviada',active:'Activo',suspended:'Suspendido',revoked:'Revocado'})[value]||'Sin acceso';}
function portalAccessCard(c){return `<section class="side-card"><small>Acceso del cliente</small><strong>${escapeHtml(portalStatusLabel(c.portalStatus))}</strong><p>${['invited','active'].includes(c.portalStatus)?'El cliente puede acceder únicamente a la información publicada para él.':'El expediente es exclusivamente interno hasta confirmar la contratación.'}</p></section>`;}

function contractPanel(c){
  const contract=(state.contracts||[]).filter(item=>item.caseId===c.id).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt))[0];
  const content=contract
    ? `<div class="contact-summary"><div><small>Anotación de Ratio</small><strong>${escapeHtml(contract.contractNote||'Sin anotación')}</strong><span>Plantilla ${escapeHtml(contract.templateKey||'ratio-servicios')} v${Number(contract.templateVersion||1)}</span></div><div><small>Causa</small><strong>${escapeHtml(contract.cause)}</strong><span>${escapeHtml(contract.workScope)}</span></div><div><small>Precio</small><strong>${escapeHtml(formatMoney(contract.priceAmount))}</strong><span>${contract.signedAt&&!contract.invalidatedAt?`Firma acreditada ${escapeHtml(formatDate(contract.signedAt))}`:contract.sentAt?`Envío registrado ${escapeHtml(formatDate(contract.sentAt))}`:'Sin firma acreditada'}</span></div></div>`
    : '<div class="empty">Todavía no se ha preparado el contrato.</div>';
  const actions=[
    !contract||(!contract.signedAt&&!contract.providerRequestId)?'<button class="secondary-button" id="prepare-contract" type="button">Editar ficha contractual</button>':'',
    contract&&!contract.signedAt&&!contract.providerRequestId?'<button class="secondary-button" id="generate-contract-pdf" type="button">Generar PDF</button>':'',
    contract?.unsignedStoragePath&&!contract.signedAt&&!contract.providerRequestId?'<button class="primary-button" id="send-contract-signature" type="button">Enviar a firma →</button>':''
  ].filter(Boolean).join('');
  return `<section class="panel"><div class="panel-head"><div><p class="kicker">Contratación separada del expediente</p><h2>Contrato de servicios</h2><p>La causa, el precio, el trabajo y cualquier anotación se escriben libremente. No existe un recorrido de estados premarcado.</p></div><div class="panel-actions">${actions}</div></div>${content}${contract?.unsignedSha256?`<p class="ai-data-scope">PDF preparado y protegido con huella SHA-256: ${escapeHtml(contract.unsignedSha256.slice(0,16))}…</p>`:''}${contract&&!contract.signedAt?'<p class="ai-data-scope">La anotación manual no acredita envío ni firma. El portal solo se habilita cuando existen el documento firmado y sus evidencias.</p>':''}</section>`;
}

function workingDocumentsPanel(c){
  const documents=(state.workingDocuments||[]).filter(item=>item.caseId===c.id);
  const content=documents.length?documents.map(document=>{
    const versions=(state.documentVersions||[]).filter(item=>item.documentId===document.id).sort((a,b)=>b.versionNumber-a.versionNumber);
    return `<article class="document-request"><div><small>${escapeHtml(document.documentType||'Documento de trabajo')}</small><strong>${escapeHtml(document.title)}</strong><p>${escapeHtml(document.statusLabel||'Sin estado indicado')} · ${versions.length} ${versions.length===1?'versión':'versiones'}</p></div><button class="secondary-button add-document-version" type="button" data-working-document-id="${escapeHtml(document.id)}">Añadir versión</button></article>`;
  }).join(''):'<div class="empty">Todavía no hay documentos de trabajo.</div>';
  return `<section class="panel case-documents"><div class="panel-head"><div><p class="kicker">Trabajo interno versionado</p><h2>Escritos y documentos</h2><p>Cada borrador se conserva como una versión independiente con la etiqueta que indiquemos.</p></div><button class="secondary-button" id="new-working-document" type="button">Nuevo documento</button></div>${content}</section>`;
}
function refreshCaseList() {
  const visible=filteredCases();
  $('#case-results').innerHTML=caseTable(visible);
  $('#case-count').textContent=`${visible.length} ${visible.length===1?'expediente':'expedientes'}`;
  bindCaseRows();
}
function bindCaseListControls() {
  $('#case-search').addEventListener('input',event=>{caseSearch=event.target.value;refreshCaseList();});
  $('#case-status-filter').addEventListener('change',event=>{caseFilter=event.target.value;refreshCaseList();});
  bindCaseRows();
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
  $('#lead-status-filter')?.addEventListener('change',event=>{leadFilter=event.target.value;renderShell();});
  $$('[data-lead-id]').forEach(node=>{
    const open=()=>openLeadDialog(node.dataset.leadId);
    node.addEventListener('click',open);
    node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
  $$('[data-task-id]').forEach(button=>button.addEventListener('click',()=>toggleTask(button.dataset.taskId)));
  bindCaseRows();
}
function openLeadDialog(leadId) {
  const lead=state.leads.find(item=>item.id===leadId); if(!lead)return;
  $('#lead-detail-id').value=lead.id;
  $('#lead-detail-title').textContent=`${lead.reference} · ${lead.name}`;
  $('#lead-detail-contact').innerHTML=`<div><small>Contacto</small><strong>${escapeHtml(lead.phone||'Sin teléfono')}</strong><span>${escapeHtml(lead.email||'Sin correo')}</span></div><div><small>Consulta</small><strong>${escapeHtml(lead.category)}</strong><span>${escapeHtml(lead.summary)}</span></div><div><small>Privacidad</small><strong>Información entregada</strong><span>${escapeHtml(formatDate(lead.privacyNoticeAt))}</span></div>`;
  $('#lead-detail-phone').value=lead.phone||'';
  $('#lead-detail-email').value=lead.email||'';
  $('#lead-detail-status').innerHTML=availableLeadStatuses(lead.status,lead.convertedCaseId).map(status=>`<option value="${escapeHtml(status)}">${escapeHtml(leadStatusLabels[status])}</option>`).join('');
  $('#lead-detail-status').value=lead.status;
  $('#lead-detail-amount').value=lead.amount||'';
  $('#lead-detail-note').value='';
  const historyCount=leadHistoryEntries(lead).length;
  $('#lead-history-count').textContent=`${historyCount} ${historyCount===1?'movimiento':'movimientos'}`;
  $('#lead-history-list').innerHTML=leadHistory(lead);
  $('#ai-assistant-result').hidden=true;
  $('#ai-assistant-result').innerHTML='';
  setModalFeedback('#lead-detail-feedback');
  if(lead.convertedCaseId)setModalFeedback('#lead-detail-feedback','Esta consulta ya está vinculada a un expediente. Puedes reenviar al cliente el correo que confirma su apertura.','info');
  $('#convert-lead').textContent=lead.convertedCaseId?'Reenviar confirmación':'Convertir en expediente';
  $('#convert-lead').disabled=lead.status!=='won'&&!lead.convertedCaseId;
  $('#lead-detail-dialog').showModal();
}
function openTaskDialog() {
  $('#task-lead').innerHTML=state.cases.filter(item=>item.statusCode==='open').map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference+' · '+item.client)}</option>`).join('');
  $('#task-date').value=new Date().toISOString().slice(0,10);
  $('#task-dialog').showModal();
}

function openCaseRecordDialog(caseItem){
  $('#case-record-id').value=caseItem.id;
  $('#case-record-title').textContent=`${caseItem.reference} · ${caseItem.client}`;
  $('#case-record-phone').value=caseItem.phone||'';
  $('#case-record-email').value=caseItem.email||'';
  $('#case-record-phase').value=caseItem.manualPhase||'';
  $('#case-record-lifecycle').value=caseItem.statusCode||'open';
  $('#case-record-amount').value=caseItem.amount||'';
  $('#case-record-note').value='';
  setModalFeedback('#case-record-feedback');
  $('#case-record-dialog').showModal();
}

async function activateCasePortal(caseItem){
  const signedContract=(state.contracts||[]).find(item=>item.caseId===caseItem.id&&item.signedAt&&!item.invalidatedAt);
  if(!signedContract){toast('El portal solo puede activarse después de recibir el contrato firmado.');return;}
  if(!confirm(`Se ha comprobado un contrato firmado para ${caseItem.client}. ¿Activar y comunicar el acceso al portal?`))return;
  const button=$('#activate-case-portal');if(button){button.disabled=true;button.textContent='Activando…';}
  try{
    if(!productionMode||!platformApi){caseItem.portalStatus='active';caseItem.contractConfirmedAt=new Date().toISOString();saveState();renderShell();return;}
    const result=await platformApi.invoke('manage-crm',{action:'activate_case_portal',caseId:caseItem.id});
    await enterProduction();activeCaseId=caseItem.id;activeSection='cases';renderShell();
    toast(result.confirmationSent===false?'Portal activado, pero el correo no pudo enviarse.':'Portal activado y acceso comunicado.');
  }catch(error){
    const messages={SIGNED_CONTRACT_REQUIRED:'No existe un contrato firmado con justificante de evidencias.',PORTAL_ALREADY_ENABLED:'El portal ya está habilitado.',EMAIL_REQUIRED_FOR_PORTAL:'El expediente necesita un correo válido.',EMAIL_BELONGS_TO_INTERNAL_USER:'Ese correo pertenece a una cuenta interna.'};
    toast(messages[error?.code]||'No se ha podido activar el portal.');
  }finally{if(button){button.disabled=false;button.textContent='Activar portal tras contrato';}}
}

function openWorkingDocumentDialog(caseItem){
  $('#working-document-form').reset();$('#working-document-case').value=caseItem.id;setModalFeedback('#working-document-feedback');$('#working-document-dialog').showModal();
}

function openContractDialog(caseItem){
  const contract=(state.contracts||[]).filter(item=>item.caseId===caseItem.id&&!item.signedAt&&!item.providerRequestId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt))[0];
  $('#contract-form').reset();$('#contract-case').value=caseItem.id;$('#contract-note').value=contract?.contractNote||'';$('#contract-signer-name').value=contract?.signerFullName||caseItem.client||'';$('#contract-signer-id').value=contract?.signerIdentifier||'';$('#contract-signer-address').value=contract?.signerAddress||'';$('#contract-cause').value=contract?.cause||caseItem.title||'';$('#contract-price').value=contract?.priceAmount||caseItem.amount||'';$('#contract-work-scope').value=contract?.workScope||'';setModalFeedback('#contract-feedback');$('#contract-dialog').showModal();
}

function openDocumentVersionDialog(documentId){
  const documentRecord=(state.workingDocuments||[]).find(item=>item.id===documentId);if(!documentRecord)return;
  $('#document-version-form').reset();$('#document-version-id').value=documentId;$('#document-version-title').textContent=`Nueva versión · ${documentRecord.title}`;$('#document-version-status').value=documentRecord.statusLabel||'';setModalFeedback('#document-version-feedback');$('#document-version-dialog').showModal();
}

document.addEventListener('click',event=>{
  const target=event.target.closest?.('button');if(!target)return;
  if(target.id==='edit-case-record'){const item=currentCase();if(item)openCaseRecordDialog(item);}
  else if(target.id==='activate-case-portal'){const item=currentCase();if(item)activateCasePortal(item);}
  else if(target.id==='resend-case-confirmation'){const item=currentCase();if(item)resendCaseConfirmation(item);}
  else if(target.id==='new-working-document'){const item=currentCase();if(item)openWorkingDocumentDialog(item);}
  else if(target.id==='prepare-contract'){const item=currentCase();if(item)openContractDialog(item);}
  else if(target.id==='generate-contract-pdf'){const item=currentCase();if(item)generateContractPdf(item,target);}
  else if(target.id==='send-contract-signature'){const item=currentCase();if(item)sendContractSignature(item,target);}
  else if(target.classList.contains('add-document-version'))openDocumentVersionDialog(target.dataset.workingDocumentId);
});

async function generateContractPdf(caseItem,button){
  const contract=(state.contracts||[]).filter(item=>item.caseId===caseItem.id&&!item.signedAt&&!item.providerRequestId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt))[0];
  if(!contract)return toast('Prepara primero la ficha contractual.');
  button.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('contract-signature',{action:'generate_contract_pdf',contractId:contract.id});await enterProduction();}
    else{contract.unsignedStoragePath=`demo/${contract.id}/unsigned.pdf`;contract.unsignedSha256='a'.repeat(64);contract.updatedAt=new Date().toISOString();saveState();}
    activeCaseId=caseItem.id;activeSection='cases';renderShell();toast('PDF contractual generado. Revisa el documento antes de enviarlo.');
  }catch(error){const message=error?.code==='CONTRACT_NOT_EDITABLE'?'Este contrato ya no puede modificarse.':error?.code==='MFA_REQUIRED'?'Confirma el segundo factor para generar el contrato.':'No se ha podido generar el PDF contractual.';toast(message);}
  finally{button.disabled=false;}
}

async function sendContractSignature(caseItem,button){
  const contract=(state.contracts||[]).filter(item=>item.caseId===caseItem.id&&!item.signedAt&&!item.providerRequestId).sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt))[0];
  if(!contract?.unsignedStoragePath)return toast('Genera y revisa primero el PDF contractual.');
  if(!confirm('Se enviará el PDF preparado al correo del firmante. ¿Has revisado causa, alcance, precio e identidad?'))return;
  button.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('contract-signature',{action:'send_contract_signature',contractId:contract.id});await enterProduction();}
    else{contract.provider='signaturit';contract.providerRequestId=`demo-${crypto.randomUUID()}`;contract.providerDocumentId=`demo-doc-${crypto.randomUUID()}`;contract.sentAt=new Date().toISOString();contract.updatedAt=contract.sentAt;saveState();}
    activeCaseId=caseItem.id;activeSection='cases';renderShell();toast('Envío registrado. La firma no se acreditará hasta verificar el PDF firmado y sus evidencias.');
  }catch(error){const messages={SIGNATURE_PROVIDER_NOT_CONFIGURED:'El proveedor de firma todavía no está configurado.',CONTRACT_PDF_REQUIRED:'Genera de nuevo el PDF antes de enviarlo.',CONTRACT_SIGNATURE_ALREADY_SENT:'El contrato ya fue enviado.',MFA_REQUIRED:'Confirma el segundo factor para realizar el envío.'};toast(messages[error?.code]||'No se ha podido enviar el contrato a firma.');}
  finally{button.disabled=false;}
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
  const maximum=state.cases.reduce((max,item)=>Math.max(max,Number(String(item.reference||'').split('-').pop())||0),0);
  return `C-${year}-${String(maximum+1).padStart(3,'0')}`;
}

function openUpdateDialog() {
  const c=currentCase();
  $('#update-title').value='';
  $('#professional-name').value=c.professionalName || '';
  $('#professional-title').value=c.professionalTitle || '';
  $('#professional-registration').value=c.professionalRegistration || '';
  $('#professional-region').value=c.professionalRegion || '';
  setModalFeedback('#update-feedback');
  $('#update-dialog').showModal();
}
function closeLeadDialog() {
  $('#lead-form').reset();
  setModalFeedback('#lead-form-feedback');
  $('#lead-dialog').close();
}
async function copyTextSafely(value) {
  const text=String(value||'');
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return true;}catch{/* Se intenta el método compatible siguiente. */}
  }
  const field=document.createElement('textarea');
  field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
  document.body.appendChild(field);field.select();
  try{return Boolean(document.execCommand?.('copy'));}catch{return false;}finally{field.remove();}
}
function renderAiAssistant(result) {
  const list=(items,empty='Ninguna detectada')=>items?.length?`<ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:`<p>${empty}</p>`;
  $('#ai-assistant-result').innerHTML=`
    <div class="ai-result-head"><strong>Análisis interno para revisión</strong><span>${escapeHtml(result.model||'Modelo configurado')}</span></div>
    <div class="ai-result-grid">
      <section><small>Resumen</small><p>${escapeHtml(result.summary)}</p></section>
      <section><small>Categoría sugerida</small><p>${escapeHtml(result.suggested_category)}</p></section>
      <section><small>Información que falta</small>${list(result.missing_information)}</section>
      <section><small>Preguntas propuestas</small>${list(result.questions_for_client)}</section>
      <section><small>Señales de urgencia</small>${list(result.urgency_flags)}</section>
      <section><small>Nota de actuación sugerida</small><p>${escapeHtml(result.suggested_internal_note)}</p></section>
    </div>
    <section class="ai-draft"><small>Borrador de respuesta</small><p>${escapeHtml(result.draft_reply)}</p></section>
    <p class="ai-caution">${escapeHtml(result.caution)}</p>
    <div class="ai-result-actions"><button class="secondary-button" id="copy-ai-draft" type="button">Copiar borrador</button><button class="secondary-button" id="use-ai-internal-note" type="button">Añadir a nota interna</button></div>`;
  $('#ai-assistant-result').hidden=false;
  $('#copy-ai-draft').addEventListener('click',async event=>{
    event.preventDefault();event.stopPropagation();
    const copied=await copyTextSafely(result.draft_reply);
    setModalFeedback('#lead-detail-feedback',copied?'Borrador copiado. Revísalo antes de enviarlo.':'No se ha podido copiar automáticamente. Selecciona el texto del borrador y cópialo manualmente.',copied?'info':'error');
  });
  $('#use-ai-internal-note').addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    const field=$('#lead-detail-note');const suggestion=String(result.suggested_internal_note||'').trim();
    field.value=(field.value.trim()?`${field.value.trim()}\n\n${suggestion}`:suggestion).slice(0,800);field.focus();
    setModalFeedback('#lead-detail-feedback','Sugerencia añadida a la nota interna. Revísala y pulsa «Guardar cambios».','info');
  });
}

function caseAiPanel() {
  return `<section class="panel case-ai-panel"><div class="ai-assistant"><div><p class="kicker">Asistente interno · revisión humana</p><h3>Analizar el expediente completo</h3><p>Revisa la ficha, la información inicial, notas, cronología, solicitudes, respuestas, documentos de trabajo y hasta tres PDF validados.</p></div><div class="ai-result-actions"><button class="secondary-button" id="test-document-ai" type="button">Probar PDF ficticio</button><button class="secondary-button" id="analyze-case-ai" type="button">Analizar expediente</button></div></div><p class="ai-data-scope">Privacidad: solo procesa PDF aceptados, con un máximo de 5 MB por archivo y 10 MB combinados. Los borradores se limitan para controlar coste y contexto. El análisis se inicia manualmente, no realiza cambios ni envía comunicaciones, registra cada archivo procesado y exige revisión humana.</p><div id="case-ai-result" class="ai-assistant-result" aria-live="polite" hidden></div><div id="case-ai-feedback" class="modal-feedback" role="status" aria-live="polite" hidden></div></section>`;
}

function renderCaseAiAssistant(result) {
  const catalog=new Map((result.source_catalog||[]).map(source=>[source.id,source]));
  const citations=ids=>(ids||[]).map(id=>catalog.get(id)).filter(Boolean).map(source=>`<span class="ai-source" title="${escapeHtml(source.id)}">${escapeHtml(source.label)}</span>`).join(' ');
  const sourcedList=(items,empty='Ninguno detectado')=>items?.length?`<ul class="ai-sourced-list">${items.map(item=>`<li><span>${escapeHtml(item.statement||item.action)}</span>${item.rationale?`<small>${escapeHtml(item.rationale)}</small>`:''}<div>${citations(item.source_ids)}</div></li>`).join('')}</ul>`:`<p>${empty}</p>`;
  const plainList=(items,empty='Ninguna detectada')=>items?.length?`<ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:`<p>${empty}</p>`;
  $('#case-ai-result').innerHTML=`
    <div class="ai-result-head"><strong>Análisis del expediente para revisión</strong><span>${escapeHtml(result.model||'Modelo configurado')} · ${escapeHtml(formatDate(result.analyzed_at||new Date().toISOString()))}</span></div>
    <div class="ai-result-grid">
      <section><small>Resumen ejecutivo</small><p>${escapeHtml(result.executive_summary)}</p></section>
      <section><small>Situación actual</small><p>${escapeHtml(result.current_position)}</p></section>
      <section><small>Hechos con fuente</small>${sourcedList(result.confirmed_facts)}</section>
      <section><small>Peticiones pendientes</small>${sourcedList(result.pending_client_requests)}</section>
      <section><small>Información que falta</small>${plainList(result.missing_information)}</section>
      <section><small>Señales de urgencia</small>${sourcedList(result.urgency_flags)}</section>
      <section><small>Posibles contradicciones</small>${sourcedList(result.contradictions)}</section>
      <section><small>Próximas acciones sugeridas</small>${sourcedList(result.suggested_next_actions)}</section>
    </div>
    <section class="ai-draft"><small>Borrador de actualización al cliente</small><p>${escapeHtml(result.draft_client_update)}</p></section>
    <p class="ai-caution">${escapeHtml(result.caution)} ${result.document_content_analyzed?'':'El contenido de los archivos no ha sido analizado.'}</p>
    <div class="ai-result-actions"><button class="secondary-button" id="copy-case-ai-draft" type="button">Copiar borrador</button></div>`;
  $('#case-ai-result').hidden=false;
  $('#copy-case-ai-draft').addEventListener('click',async()=>{
    const copied=await copyTextSafely(result.draft_client_update);
    setModalFeedback('#case-ai-feedback',copied?'Borrador copiado. Revísalo antes de utilizarlo.':'No se ha podido copiar automáticamente.',copied?'info':'error');
  });
}

async function analyzeCurrentCase(caseItem) {
  const button=$('#analyze-case-ai');if(!button)return;
  const original=button.textContent;button.disabled=true;button.textContent='Analizando…';
  setModalFeedback('#case-ai-feedback','Analizando el expediente y comprobando sus fuentes. Puede tardar unos segundos…','info');
  try{
    const demo={model:'Piloto demostrativo',analyzed_at:new Date().toISOString(),executive_summary:'El expediente está en curso y contiene una solicitud pendiente al cliente.',current_position:'Debe revisarse la documentación solicitada antes de proponer nuevas actuaciones.',confirmed_facts:[{statement:'Existe una solicitud pendiente.',source_ids:['request:req_01']}],pending_client_requests:[{statement:'Contrato de la tarjeta pendiente de entrega.',source_ids:['request:req_01']}],missing_information:['Contenido del contrato solicitado'],urgency_flags:[],contradictions:[],suggested_next_actions:[{action:'Esperar la entrega solicitada y revisarla.',rationale:'La decisión debe basarse en el documento.',source_ids:['request:req_01'],requires_human_review:true}],draft_client_update:'Hemos revisado el expediente. Para continuar necesitamos que entregues el documento solicitado desde tu plataforma privada.',caution:'Análisis orientativo sujeto a revisión humana.',source_catalog:[{id:'request:req_01',label:'Contrato de la tarjeta',type:'client_request',at:new Date().toISOString()}],document_content_analyzed:false};
    const result=productionMode&&platformApi?await platformApi.invoke('ai-assist',{action:'analyze_case',caseId:caseItem.id}):demo;
    renderCaseAiAssistant(result);setModalFeedback('#case-ai-feedback');
  }catch(error){
    const messages={AI_NOT_CONFIGURED:'Falta configurar la clave privada del servicio de análisis.',AI_BUDGET_EXCEEDED:'Se ha alcanzado el límite mensual configurado.',AI_KEY_INVALID:'La clave del servicio de análisis no es válida.',AI_QUOTA_EXCEEDED:'La cuenta del servicio de análisis no tiene cuota disponible.',AI_MODEL_UNAVAILABLE:'El modelo configurado no está disponible.',AI_REQUEST_INVALID:'El servicio rechazó la configuración del análisis.',AI_TEMPORARILY_UNAVAILABLE:'El servicio de análisis no está disponible temporalmente.',UNAUTHENTICATED:'Tu sesión ha caducado.',MFA_REQUIRED:'Vuelve a confirmar el segundo factor.',FORBIDDEN:'Tu usuario no tiene permiso para analizar expedientes.',CASE_NOT_FOUND:'El expediente ya no está disponible.'};
    setModalFeedback('#case-ai-feedback',messages[error?.code]||`No se ha podido analizar el expediente${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }finally{button.disabled=false;button.textContent=original;}
}
async function testSyntheticDocumentPipeline(){
  const button=$('#test-document-ai');if(!button)return;
  const original=button.textContent;button.disabled=true;button.textContent='Probando…';
  setModalFeedback('#case-ai-feedback','Generando y leyendo un PDF ficticio sin datos personales…','info');
  try{
    if(!productionMode||!platformApi){setModalFeedback('#case-ai-feedback','La prueba completa solo está disponible en el CRM protegido.','info');return;}
    const result=await platformApi.invoke('ai-assist',{action:'test_document_pipeline'});
    setModalFeedback('#case-ai-feedback',result.test_passed?`Prueba superada. Texto detectado: ${result.detected_text}`:`La API respondió, pero no identificó correctamente el PDF ficticio: ${result.caution}` ,result.test_passed?'info':'error');
  }catch(error){
    setModalFeedback('#case-ai-feedback',`No se ha podido completar la prueba documental${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }finally{button.disabled=false;button.textContent=original;}
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
function setModalFeedback(selector,message='',kind='error') {
  const node=$(selector);if(!node)return;
  node.textContent=message;
  node.className=`modal-feedback ${kind}`;
  node.hidden=!message;
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
    caseId:currentCase().id,title:$('#update-title').value.trim(),
    professionalName:$('#professional-name').value.trim(),professionalTitle:$('#professional-title').value.trim(),
    professionalRegistration:$('#professional-registration').value.trim(),professionalRegion:$('#professional-region').value.trim()
  };
  if(!payload.title){setModalFeedback('#update-feedback','Añade el título del avance para guardar el cambio.');$('#update-title').focus();return;}
  const submitter=event.submitter||$('#update-form .primary-button');const originalLabel=submitter.innerHTML;submitter.disabled=true;submitter.textContent='Guardando avance…';
  setModalFeedback('#update-feedback','Guardando el avance…','info');
  try{
    if(productionMode&&platformApi){
      const result=await platformApi.invoke('update-case',payload);
      await enterProduction();
      activeCaseId=payload.caseId;
      activeSection='cases';
      renderShell();
      payload.emailSent=result.emailSent;
    }
    else{
      const c=currentCase();Object.assign(c,{professionalName:payload.professionalName,professionalTitle:payload.professionalTitle,professionalRegistration:payload.professionalRegistration,professionalRegion:payload.professionalRegion});
      const at=new Date().toISOString();state.events.forEach(item=>item.current=false);state.events.push({id:crypto.randomUUID(),caseId:c.id,kind:'case_update',title:payload.title,description:payload.title,at,current:true});
      state.notifications.push({id:crypto.randomUUID(),userId:state.users.client.id,caseId:c.id,title:'Nuevo avance en tu expediente',body:payload.title,at,read:false});
      log('case_updated','case',c.id);saveState();renderShell();
    }
    setModalFeedback('#update-feedback');$('#update-form').reset();$('#update-dialog').close();toast(payload.emailSent===false?'Avance guardado en la plataforma, pero el correo no pudo enviarse.':'Avance guardado y cliente avisado por email.');
  }catch(error){
    const messages={UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',UNAUTHORIZED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',MFA_REQUIRED:'Vuelve a confirmar el código de tu app de autenticación.',FORBIDDEN:'Tu usuario no tiene permiso para modificar expedientes.',INVALID_FIELDS:'Revisa el título del avance.'};
    setModalFeedback('#update-feedback',messages[error?.code]||`No se ha podido guardar el avance${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
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
  event.preventDefault();
  const payload={
    fullName:$('#lead-name').value.trim(),phone:$('#lead-phone').value.trim(),email:$('#lead-email').value.trim().toLowerCase(),province:$('#lead-province').value.trim(),
    category:$('#lead-category').value,source:$('#lead-source').value,summary:$('#lead-summary').value.trim(),privacyNoticeAcknowledged:Boolean($('#lead-privacy-notice').checked)
  };
  if(!payload.phone||!payload.email){setModalFeedback('#lead-form-feedback','Indica el teléfono y el correo electrónico.');return;}
  const submitter=event.submitter||$('#lead-form .primary-button');const originalLabel=submitter.innerHTML;submitter.disabled=true;submitter.textContent='Creando expediente…';
  setModalFeedback('#lead-form-feedback','Creando el expediente interno…','info');
  try{
    let created=null;
    if(productionMode&&platformApi){created=await platformApi.invoke('manage-crm',{action:'create_case',...payload});await enterProduction();}
    else{
      const at=new Date().toISOString();const id=crypto.randomUUID();
      created={id,reference:nextLeadReference()};
      state.cases.unshift({id,reference:created.reference,clientId:'',client:payload.fullName,title:payload.summary.slice(0,160),category:payload.category,statusCode:'open',status:'Abierto',manualPhase:'',portalStatus:'disabled',phone:payload.phone,email:payload.email,province:payload.province,source:payload.source,amount:0,privacyNoticeAt:at,legalBasis:'precontractual_request',openedAt:at,clientNextStep:'',professionalName:'',professionalTitle:'',professionalRegistration:'',professionalRegion:''});
      state.events.push({id:crypto.randomUUID(),caseId:id,kind:'consultation_received',title:'Consulta inicial recibida',description:payload.summary,at,current:true});
      log('case_created','case',id,{source:payload.source});saveState();
    }
    setModalFeedback('#lead-form-feedback');$('#lead-form').reset();$('#lead-dialog').close();activeCaseId=created?.id||null;activeSection='cases';renderShell();toast('Expediente creado correctamente. El portal continúa desactivado.');
  }catch(error){
    const messages={UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',UNAUTHORIZED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',MFA_REQUIRED:'Vuelve a confirmar el código de tu app de autenticación.',FORBIDDEN:'Tu usuario no tiene permiso para registrar consultas.',INVALID_FIELDS:'Revisa los datos: nombre, teléfono, correo, resumen y confirmación de privacidad.'};
    setModalFeedback('#lead-form-feedback',messages[error?.code]||`No se ha podido registrar la consulta${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }
  finally{submitter.disabled=false;submitter.innerHTML=originalLabel;}
});
$('#cancel-lead').addEventListener('click',closeLeadDialog);
$('#close-lead-dialog').addEventListener('click',closeLeadDialog);
$('#lead-detail-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#lead-detail-dialog').close();return;}
  const lead=state.leads.find(item=>item.id===$('#lead-detail-id').value);if(!lead)return;
  const changes={phone:$('#lead-detail-phone').value.trim(),email:$('#lead-detail-email').value.trim().toLowerCase(),status:$('#lead-detail-status').value,amount:Number($('#lead-detail-amount').value||0),note:$('#lead-detail-note').value.trim()};
  if(!changes.phone||!changes.email){setModalFeedback('#lead-detail-feedback','La consulta debe conservar el teléfono y el correo electrónico.');return;}
  if(!canAdvanceLeadStatus(lead.status,changes.status,lead.convertedCaseId)){setModalFeedback('#lead-detail-feedback','El estado no puede retroceder. Selecciona el estado actual o uno posterior.');return;}
  const submitter=event.submitter||$('#lead-detail-form .primary-button');const originalLabel=submitter.innerHTML;submitter.disabled=true;submitter.textContent='Guardando cambios…';
  setModalFeedback('#lead-detail-feedback','Guardando los cambios…','info');
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'update_lead',leadId:lead.id,...changes});await enterProduction();}
    else{
      const previousStatus=lead.status,at=new Date().toISOString(),authorName=currentUser()?.name||'Equipo Ratio';
      Object.assign(lead,{phone:changes.phone,email:changes.email,status:changes.status,amount:changes.amount,updatedAt:at});
      if(previousStatus!==changes.status)lead.notes.push({id:crypto.randomUUID(),body:`Estado cambiado de «${leadStatusLabels[previousStatus]||previousStatus}» a «${leadStatusLabels[changes.status]||changes.status}».`,authorName,at});
      if(changes.note)lead.notes.push({id:crypto.randomUUID(),body:changes.note,authorName,at});
      log('lead_updated','crm_lead',lead.id,{status:changes.status});saveState();
    }
    setModalFeedback('#lead-detail-feedback');$('#lead-detail-dialog').close();renderShell();toast(changes.status==='lost'?'Consulta archivada. Puedes recuperarla con el filtro «No viables / cerradas».':'Consulta actualizada.');
  }catch(error){
    const messages={UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',UNAUTHORIZED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',MFA_REQUIRED:'Vuelve a confirmar el código de tu app de autenticación.',FORBIDDEN:'Tu usuario no tiene permiso para modificar consultas.',INVALID_FIELDS:'Revisa los datos de la consulta.',STATUS_REGRESSION:'El estado no puede retroceder. Selecciona el estado actual o uno posterior.'};
    setModalFeedback('#lead-detail-feedback',messages[error?.code]||`No se ha podido actualizar la consulta${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }
  finally{submitter.disabled=false;submitter.innerHTML=originalLabel;}
});
$('#analyze-lead-ai').addEventListener('click',async()=>{
  const leadId=$('#lead-detail-id').value;if(!leadId)return;
  const button=$('#analyze-lead-ai');const original=button.textContent;button.disabled=true;button.textContent='Analizando…';
  setModalFeedback('#lead-detail-feedback','Analizando la consulta. Puede tardar unos segundos…','info');
  try{
    if(!productionMode||!platformApi){
      renderAiAssistant({model:'Piloto demostrativo',summary:'Consulta que necesita ampliar información antes de valorar el siguiente paso.',suggested_category:state.leads.find(item=>item.id===leadId)?.category||'Pendiente',missing_information:['Documentación disponible','Importes y fechas principales'],questions_for_client:['¿Qué ocurrió y en qué fecha?','¿Qué respuesta has recibido hasta ahora?'],urgency_flags:[],draft_reply:'Gracias por contarnos tu situación. Para estudiarla necesitamos que nos indiques las fechas principales, los importes y qué respuesta has recibido hasta ahora.',suggested_internal_note:'Contactar para ampliar información.',caution:'Sugerencia interna generada por IA. Debe revisarse antes de utilizarse.'});
    }else renderAiAssistant(await platformApi.invoke('ai-assist',{action:'analyze_lead',leadId}));
    setModalFeedback('#lead-detail-feedback');
  }catch(error){
    const messages={AI_NOT_CONFIGURED:'Falta configurar la clave privada del servicio de análisis.',AI_BUDGET_EXCEEDED:'Se ha alcanzado el límite mensual configurado.',AI_KEY_INVALID:'La clave del servicio de análisis no es válida.',AI_QUOTA_EXCEEDED:'La cuenta del servicio de análisis no tiene cuota disponible.',AI_MODEL_UNAVAILABLE:'El modelo configurado no está disponible para esta cuenta.',AI_REQUEST_INVALID:'El servicio rechazó la configuración del análisis.',AI_TEMPORARILY_UNAVAILABLE:'El servicio de análisis no está disponible temporalmente. Inténtalo de nuevo más tarde.',UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',UNAUTHORIZED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',MFA_REQUIRED:'Vuelve a confirmar el segundo factor para usar el asistente.',FORBIDDEN:'Tu usuario no tiene permiso para usar el asistente.'};
    const reference=error?.details?.requestId?` Referencia: ${error.details.requestId}.`:'';
    setModalFeedback('#lead-detail-feedback',(messages[error?.code]||'No se ha podido generar el análisis interno.')+reference);
  }finally{button.disabled=false;button.textContent=original;}
});
async function resendCaseConfirmation(caseItem) {
  if(!caseItem)return;
  const button=$('#resend-case-confirmation')||$('#convert-lead');
  const originalLabel=button?.textContent||'Reenviar confirmación';
  if(button){button.disabled=true;button.textContent='Enviando…';}
  try{
    if(!productionMode||!platformApi){toast('En producción se reenviará la confirmación al cliente.');return;}
    await platformApi.invoke('manage-crm',{action:'resend_case_confirmation_by_case',caseId:caseItem.id});
    toast('Confirmación del expediente enviada.');
  }catch(error){
    const messages={EMAIL_DELIVERY_FAILED:'No se ha podido enviar la confirmación. Revisa el servicio de correo.',CASE_CONFIRMATION_UNAVAILABLE:'Este expediente no tiene un correo de confirmación disponible.',UNAUTHENTICATED:'Tu sesión ha caducado. Vuelve a iniciar sesión.',MFA_REQUIRED:'Vuelve a confirmar el código de tu app de autenticación.'};
    toast(messages[error?.code]||`No se ha podido reenviar la confirmación${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }finally{if(button){button.disabled=false;button.textContent=originalLabel;}}
}
$('#convert-lead').addEventListener('click',async()=>{
  const lead=state.leads.find(item=>item.id===$('#lead-detail-id').value);if(!lead)return;
  const button=$('#convert-lead');button.disabled=true;
  try{
    if(lead.convertedCaseId){
      await resendCaseConfirmation(lead);
      return;
    }
    let conversion=null;
    if(productionMode&&platformApi){conversion=await platformApi.invoke('manage-crm',{action:'convert_lead',leadId:lead.id});await enterProduction();}
    else{
      const caseId=crypto.randomUUID();
      const clientId=`lead-client-${lead.id}`;
      state.cases.unshift({id:caseId,reference:`RS-${new Date().getFullYear()}-${String(state.cases.length+1).padStart(4,'0')}`,clientId,client:lead.name,title:lead.summary.slice(0,100),category:lead.category,statusCode:'open',status:'Abierto',stage:0,openedAt:new Date().toISOString(),clientNextStep:'',professionalName:'',professionalTitle:'',professionalRegistration:'',professionalRegion:lead.province});
      state.events.push({id:crypto.randomUUID(),caseId,kind:'open',title:'Expediente abierto',description:'La consulta ha sido aceptada y convertida en expediente.',at:new Date().toISOString(),current:true});
      lead.status='won';lead.updatedAt=new Date().toISOString();activeCaseId=caseId;
      log('lead_converted','crm_lead',lead.id,{caseId});saveState();
    }
    $('#lead-detail-dialog').close();activeSection='cases';renderShell();toast(conversion&&!conversion.confirmationSent?'Expediente creado. El correo no pudo enviarse; puedes reenviarlo desde la consulta.':'Consulta convertida y confirmación enviada al cliente.');
  }catch(error){
    const messages={EMAIL_REQUIRED_FOR_PORTAL:'Añade un correo electrónico antes de crear el acceso del cliente.',LEAD_NOT_CONTRACTED:'Marca primero la consulta como «Contratada».',LEAD_ALREADY_CONVERTED:'Esta consulta ya está vinculada a un expediente.',EMAIL_BELONGS_TO_INTERNAL_USER:'Ese correo pertenece a un usuario interno. Utiliza el correo del cliente.',EMAIL_DELIVERY_FAILED:'No se ha podido enviar la confirmación. Revisa el servicio de correo antes de repetirlo.'};
    toast(messages[error?.code]||`No se ha podido convertir la consulta${error?.details?.requestId?` (referencia ${error.details.requestId})`:''}.`);
  }
  finally{button.disabled=false;}
});
$('#task-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#task-dialog').close();return;}
  const payload={title:$('#task-title').value.trim(),dueDate:$('#task-date').value,priority:$('#task-priority').value,caseId:$('#task-lead').value};
  const submitter=event.submitter;submitter.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',{action:'create_task',...payload});await enterProduction();}
    else{const id=crypto.randomUUID();state.tasks.push({id,...payload,completed:false,createdAt:new Date().toISOString()});log('task_created','crm_task',id);saveState();}
    $('#task-form').reset();$('#task-dialog').close();activeSection='tasks';renderShell();toast('Tarea registrada.');
  }catch{toast('No se ha podido registrar la tarea.');}
  finally{submitter.disabled=false;}
});
$('#case-record-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#case-record-dialog').close();return;}
  const payload={action:'update_case_record',caseId:$('#case-record-id').value,phone:$('#case-record-phone').value.trim(),email:$('#case-record-email').value.trim().toLowerCase(),manualPhase:$('#case-record-phase').value.trim(),lifecycle:$('#case-record-lifecycle').value,amount:Number($('#case-record-amount').value||0),note:$('#case-record-note').value.trim()};
  const button=event.submitter;button.disabled=true;setModalFeedback('#case-record-feedback','Guardando en la cronología…','info');
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',payload);await enterProduction();activeCaseId=payload.caseId;activeSection='cases';}
    else{const item=state.cases.find(c=>c.id===payload.caseId);if(item){Object.assign(item,{phone:payload.phone,email:payload.email,manualPhase:payload.manualPhase,status:payload.manualPhase||statusLabels[payload.lifecycle],statusCode:payload.lifecycle,amount:payload.amount});const at=new Date().toISOString();if(payload.manualPhase)state.events.push({id:crypto.randomUUID(),caseId:item.id,kind:'internal_phase_changed',title:payload.manualPhase,description:'',at,current:true});if(payload.note)state.events.push({id:crypto.randomUUID(),caseId:item.id,kind:'internal_note',title:'Nota interna',description:payload.note,at,current:true});saveState();}}
    $('#case-record-dialog').close();renderShell();toast('Ficha e historial actualizados.');
  }catch(error){setModalFeedback('#case-record-feedback',error?.code==='INVALID_FIELDS'?'Revisa teléfono, correo y datos introducidos.':'No se ha podido actualizar el expediente.');}
  finally{button.disabled=false;}
});
$('#contract-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#contract-dialog').close();return;}
  const payload={action:'save_contract_record',caseId:$('#contract-case').value,contractNote:$('#contract-note').value.trim(),signerFullName:$('#contract-signer-name').value.trim(),signerIdentifier:$('#contract-signer-id').value.trim(),signerAddress:$('#contract-signer-address').value.trim(),cause:$('#contract-cause').value.trim(),workScope:$('#contract-work-scope').value.trim(),priceAmount:Number($('#contract-price').value)};
  const button=event.submitter;button.disabled=true;setModalFeedback('#contract-feedback','Guardando la ficha contractual…','info');
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',payload);await enterProduction();activeCaseId=payload.caseId;activeSection='cases';}
    else{
      let contract=state.contracts.find(item=>item.caseId===payload.caseId&&!item.signedAt&&!item.providerRequestId);const at=new Date().toISOString();
      if(contract)Object.assign(contract,{contractNote:payload.contractNote,signerFullName:payload.signerFullName,signerIdentifier:payload.signerIdentifier,signerAddress:payload.signerAddress,cause:payload.cause,workScope:payload.workScope,priceAmount:payload.priceAmount,updatedAt:at});
      else state.contracts.push({id:crypto.randomUUID(),caseId:payload.caseId,templateKey:'ratio-servicios',templateVersion:1,contractNote:payload.contractNote,signerFullName:payload.signerFullName,signerIdentifier:payload.signerIdentifier,signerAddress:payload.signerAddress,cause:payload.cause,workScope:payload.workScope,priceAmount:payload.priceAmount,currency:'EUR',createdAt:at,updatedAt:at});
      saveState();
    }
    $('#contract-dialog').close();renderShell();toast('Ficha contractual guardada. La firma solo constará cuando el sistema reciba evidencias válidas.');
  }catch(error){const messages={CASE_NOT_OPEN:'Solo se prepara contrato para un expediente abierto.'};setModalFeedback('#contract-feedback',messages[error?.code]||'No se ha podido guardar el contrato.');}
  finally{button.disabled=false;}
});
$('#working-document-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#working-document-dialog').close();return;}
  const payload={action:'create_working_document',caseId:$('#working-document-case').value,title:$('#working-document-title').value.trim(),documentType:$('#working-document-type').value.trim(),statusLabel:$('#working-document-status').value.trim()};
  const button=event.submitter;button.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',payload);await enterProduction();activeCaseId=payload.caseId;activeSection='cases';}
    else{state.workingDocuments.push({id:crypto.randomUUID(),caseId:payload.caseId,title:payload.title,documentType:payload.documentType,statusLabel:payload.statusLabel,visibility:'internal',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});saveState();}
    $('#working-document-dialog').close();renderShell();toast('Documento de trabajo creado.');
  }catch{setModalFeedback('#working-document-feedback','No se ha podido crear el documento.');}
  finally{button.disabled=false;}
});
$('#document-version-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#document-version-dialog').close();return;}
  const payload={action:'add_working_document_version',documentId:$('#document-version-id').value,statusLabel:$('#document-version-status').value.trim(),changeSummary:$('#document-version-summary').value.trim(),draftContent:$('#document-version-content').value};
  const documentRecord=state.workingDocuments.find(item=>item.id===payload.documentId);const button=event.submitter;button.disabled=true;
  try{
    if(productionMode&&platformApi){await platformApi.invoke('manage-crm',payload);await enterProduction();activeCaseId=documentRecord?.caseId||activeCaseId;activeSection='cases';}
    else{const versionNumber=state.documentVersions.filter(item=>item.documentId===payload.documentId).length+1;state.documentVersions.push({id:crypto.randomUUID(),documentId:payload.documentId,versionNumber,statusLabel:payload.statusLabel,changeSummary:payload.changeSummary,draftContent:payload.draftContent,createdAt:new Date().toISOString()});if(documentRecord)documentRecord.statusLabel=payload.statusLabel;saveState();}
    $('#document-version-dialog').close();renderShell();toast('Nueva versión guardada sin sobrescribir las anteriores.');
  }catch{setModalFeedback('#document-version-feedback','No se ha podido guardar esta versión.');}
  finally{button.disabled=false;}
});
$('#document-request-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.submitter?.value==='cancel'){$('#document-request-dialog').close();return;}
  const payload={action:'request_document',caseId:$('#document-request-case').value,requestType:$('#document-request-type').value,title:$('#document-request-title').value.trim(),instructions:$('#document-request-instructions').value.trim()};
  if(payload.title.length<3){setModalFeedback('#document-request-feedback','Indica con claridad qué necesitas del cliente.');return;}
  const button=event.submitter||$('#document-request-form .primary-button');const original=button.innerHTML;button.disabled=true;button.textContent='Creando solicitud…';
  setModalFeedback('#document-request-feedback','Creando la solicitud y registrando el aviso…','info');
  try{
    let result={emailSent:true};
    if(productionMode&&platformApi){
      result=await platformApi.invoke('document-workflow',payload);
      await enterProduction();activeCaseId=payload.caseId;activeSection='cases';renderShell();
    }else{
      const at=new Date().toISOString(),id=crypto.randomUUID();
      const isDocument=payload.requestType==='document';
      state.documentRequests.unshift({id,caseId:payload.caseId,requestType:payload.requestType,title:payload.title,instructions:payload.instructions,status:'pending',responseText:'',responseAt:'',requestedAt:at,requestedBy:currentUser().id});
      state.events.push({id:crypto.randomUUID(),caseId:payload.caseId,kind:isDocument?'document_requested':'clarification_requested',title:`${isDocument?'Documentación':'Aclaración'} solicitada: ${payload.title}`,description:payload.instructions,at,current:true});
      state.notifications.push({id:crypto.randomUUID(),userId:state.users.client.id,caseId:payload.caseId,title:isDocument?'Nueva solicitud de documentación':'Necesitamos una aclaración',body:payload.title,at,read:false});
      log(isDocument?'document_requested':'clarification_requested','client_request',id);saveState();renderShell();
    }
    $('#document-request-form').reset();$('#document-request-dialog').close();
    toast(result.emailSent===false?'Solicitud creada. El aviso está en el portal, pero el correo no pudo enviarse.':'Solicitud creada y cliente avisado.');
  }catch(error){
    const messages={CASE_CLOSED:'No se puede crear una solicitud en un expediente cerrado.',INVALID_CLIENT_REQUEST:'Revisa el tipo y el título de la solicitud.',MFA_REQUIRED:'Vuelve a confirmar el código de tu app de autenticación.',FORBIDDEN:'Tu usuario no tiene permiso para crear solicitudes.'};
    setModalFeedback('#document-request-feedback',messages[error?.code]||'No se ha podido crear la solicitud.');
  }finally{button.disabled=false;button.innerHTML=original;}
});
$('#clarification-response-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.submitter?.value==='cancel'){$('#clarification-response-dialog').close();return;}
  const caseId=$('#clarification-response-case').value,requestId=$('#clarification-response-request').value,responseText=$('#clarification-response-text').value.trim();
  if(responseText.length<2){setModalFeedback('#clarification-response-feedback','Escribe la aclaración antes de enviarla.');return;}
  const button=event.submitter||$('#clarification-response-form .primary-button');const original=button.innerHTML;button.disabled=true;button.textContent='Enviando aclaración…';
  setModalFeedback('#clarification-response-feedback','Guardando la respuesta en el expediente…','info');
  try{
    if(productionMode&&platformApi){
      await platformApi.invoke('document-workflow',{action:'submit_clarification',caseId,requestId,responseText});
      await enterProduction();activeCaseId=caseId;activeSection='overview';renderShell();
    }else{
      const at=new Date().toISOString(),request=state.documentRequests.find(item=>item.id===requestId);
      if(request){request.status='submitted';request.responseText=responseText;request.responseAt=at;request.fulfilledAt=at;}
      state.events.push({id:crypto.randomUUID(),caseId,kind:'clarification_submitted',title:`Aclaración enviada: ${request?.title||'Respuesta solicitada'}`,description:responseText,at,current:true});
      state.notifications.push({id:crypto.randomUUID(),userId:state.users.admin.id,caseId,title:'Aclaración recibida',body:request?.title||'Respuesta del cliente',at,read:false});
      log('clarification_submitted','client_request',requestId);saveState();renderShell();
    }
    $('#clarification-response-form').reset();$('#clarification-response-dialog').close();toast('Aclaración enviada y registrada en tu expediente.');
  }catch(error){
    const messages={INVALID_CLARIFICATION_RESPONSE:'Revisa la aclaración antes de enviarla.',CLIENT_REQUEST_ACCESS_DENIED:'No tienes acceso a esta solicitud.',DOCUMENT_REQUEST_UNAVAILABLE:'Esta solicitud ya no admite respuestas.'};
    setModalFeedback('#clarification-response-feedback',messages[error?.code]||'No se ha podido guardar la aclaración. Vuelve a intentarlo.');
  }finally{button.disabled=false;button.innerHTML=original;}
});
$('#document-file').addEventListener('change',event=>{
  const file=event.target.files?.[0];
  $('#document-file-name').textContent=file?`${file.name} · ${formatFileSize(file.size)}`:'Ningún archivo seleccionado';
});
$('#document-upload-form').addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.submitter?.value==='cancel'){$('#document-upload-dialog').close();return;}
  const file=$('#document-file').files?.[0];
  if(!$('#document-privacy-notice').checked){setModalFeedback('#document-upload-feedback','Lee y acepta la información de privacidad antes de continuar.');return;}
  if(!file||file.size<1||file.size>5*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(file.type)){setModalFeedback('#document-upload-feedback','Selecciona un PDF, JPG o PNG de hasta 5 MB.');return;}
  const button=event.submitter||$('#document-upload-form .primary-button');const original=button.innerHTML;button.disabled=true;button.textContent='Entregando archivo…';
  setModalFeedback('#document-upload-feedback','Cifrando la conexión y entregando el archivo…','info');
  try{
    const caseId=$('#document-upload-case').value,requestId=$('#document-upload-request').value;
    if(productionMode&&platformApi){
      await platformApi.invokeMultipart('document-workflow',new FormData(event.currentTarget));
      await enterProduction();activeCaseId=caseId;activeSection='overview';renderShell();
    }else{
      const at=new Date().toISOString(),id=crypto.randomUUID(),request=state.documentRequests.find(item=>item.id===requestId);
      state.caseDocuments.unshift({id,caseId,requestId,originalName:file.name,mimeType:file.type,sizeBytes:file.size,status:'uploaded',uploadedBy:currentUser().id,privacyNoticeAt:at,createdAt:at});
      if(request){request.status='submitted';request.fulfilledAt=at;}
      state.events.push({id:crypto.randomUUID(),caseId,kind:'document_uploaded',title:`Documentación entregada: ${request?.title||'Archivo solicitado'}`,description:'',at,current:true});
      log('document_uploaded','case_document',id);saveState();renderShell();
    }
    $('#document-upload-form').reset();$('#document-upload-dialog').close();toast('Archivo entregado correctamente y registrado en tu expediente.');
  }catch(error){
    const messages={PRIVACY_NOTICE_REQUIRED:'Debes leer y aceptar la información de privacidad.',INVALID_DOCUMENT_FILE:'El archivo no es válido o supera 5 MB.',DOCUMENT_REQUEST_UNAVAILABLE:'Esta solicitud ya no admite entregas.',DOCUMENT_ACCESS_DENIED:'No tienes acceso a esta solicitud.'};
    setModalFeedback('#document-upload-feedback',messages[error?.code]||'No se ha podido entregar el archivo. No lo envíes por correo; vuelve a intentarlo.');
  }finally{button.disabled=false;button.innerHTML=original;}
});
async function downloadDocument(documentId,button){
  const original=button.textContent;button.disabled=true;button.textContent='Preparando…';
  try{
    if(!productionMode||!platformApi){toast('La descarga real se habilita únicamente en el portal conectado.');return;}
    const result=await platformApi.invoke('document-workflow',{action:'download_document',documentId});
    const url=new URL(result.url);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw new Error('INVALID_DOWNLOAD_URL');
    const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';document.body.appendChild(link);link.click();link.remove();
    toast('Enlace seguro creado durante 60 segundos.');
  }catch{toast('No se ha podido preparar la descarga segura.');}
  finally{button.disabled=false;button.textContent=original;}
}
async function reviewDocument(documentId,status,button){
  const original=button.textContent;button.disabled=true;button.textContent='Guardando…';
  try{
    if(productionMode&&platformApi){await platformApi.invoke('document-workflow',{action:'review_document',documentId,status});await enterProduction();activeSection='cases';activeCaseId=state.caseDocuments.find(item=>item.id===documentId)?.caseId||activeCaseId;renderShell();}
    else{const item=state.caseDocuments.find(document=>document.id===documentId);if(item)item.status=status;saveState();renderShell();}
    toast(status==='accepted'?'Documento validado.':'Documento marcado para revisión.');
  }catch{toast('No se ha podido actualizar el documento.');}
  finally{button.disabled=false;button.textContent=original;}
}
async function cancelClientRequest(requestId,button){
  if(!window.confirm('¿Retirar esta solicitud? El cliente verá que ya no tiene que responderla.'))return;
  const original=button.textContent;button.disabled=true;button.textContent='Retirando…';
  try{
    const request=state.documentRequests.find(item=>item.id===requestId);
    if(productionMode&&platformApi){await platformApi.invoke('document-workflow',{action:'cancel_request',requestId});await enterProduction();activeCaseId=request?.caseId||activeCaseId;activeSection='cases';renderShell();}
    else if(request){request.status='cancelled';const at=new Date().toISOString();state.events.push({id:crypto.randomUUID(),caseId:request.caseId,kind:'client_request_cancelled',title:`Solicitud retirada: ${request.title}`,description:'Ya no necesitamos esta respuesta.',at,current:true});saveState();renderShell();}
    toast('Solicitud retirada. El cliente ya no tiene que responderla.');
  }catch{toast('No se ha podido retirar la solicitud.');}
  finally{button.disabled=false;button.textContent=original;}
}

$('#communication-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#communication-dialog').close();return;}
  const payload={action:'request_communication',caseId:$('#communication-case').value,subject:$('#communication-subject').value.trim(),message:$('#communication-message').value.trim(),deadlineContext:$('#communication-deadline').value.trim(),availabilityNote:$('#communication-availability').value.trim()};
  if(payload.subject.length<3||payload.message.length<10){setModalFeedback('#communication-feedback','Indica el asunto y explica brevemente qué necesitas.');return;}
  const button=event.submitter;const original=button.innerHTML;button.disabled=true;button.textContent='Enviando solicitud…';
  try{
    if(productionMode&&platformApi){await platformApi.invoke('case-communications',payload);await enterProduction();activeCaseId=payload.caseId;activeSection='overview';}
    else{const at=new Date().toISOString(),id=crypto.randomUUID();state.communicationRequests.unshift({id,caseId:payload.caseId,requestedBy:currentUser().id,subject:payload.subject,message:payload.message,deadlineContext:payload.deadlineContext,availabilityNote:payload.availabilityNote,responseText:'',respondedAt:'',createdAt:at});state.notifications.push({id:crypto.randomUUID(),userId:state.users.admin.id,caseId:payload.caseId,title:'Nueva solicitud de comunicación',body:payload.subject,at,read:false});state.events.push({id:crypto.randomUUID(),caseId:payload.caseId,kind:'client_communication_requested',title:'Solicitud enviada a Ratio',description:payload.subject,at,current:true});saveState();}
    $('#communication-form').reset();$('#communication-dialog').close();renderShell();toast('Solicitud enviada. Queda registrada en tu expediente.');
  }catch(error){const messages={INVALID_COMMUNICATION_REQUEST:'Revisa el asunto y el texto de la solicitud.',COMMUNICATION_ACCESS_DENIED:'No tienes acceso a este expediente.',CASE_CLOSED:'El expediente está cerrado.'};setModalFeedback('#communication-feedback',messages[error?.code]||'No se ha podido enviar la solicitud. Vuelve a intentarlo.');}
  finally{button.disabled=false;button.innerHTML=original;}
});

$('#communication-response-form').addEventListener('submit',async event=>{
  event.preventDefault();if(event.submitter?.value==='cancel'){$('#communication-response-dialog').close();return;}
  const communicationId=$('#communication-response-id').value,responseText=$('#communication-response-text').value.trim();
  if(responseText.length<2){setModalFeedback('#communication-response-feedback','Escribe la respuesta antes de enviarla.');return;}
  const button=event.submitter;const original=button.innerHTML;button.disabled=true;button.textContent='Guardando respuesta…';
  try{
    const item=(state.communicationRequests||[]).find(record=>record.id===communicationId);
    if(productionMode&&platformApi){await platformApi.invoke('case-communications',{action:'respond_communication',communicationId,responseText});await enterProduction();activeCaseId=item?.caseId||activeCaseId;activeSection='cases';}
    else if(item){item.responseText=responseText;item.respondedAt=new Date().toISOString();state.notifications.push({id:crypto.randomUUID(),userId:state.users.client.id,caseId:item.caseId,title:'Respuesta a tu solicitud',body:item.subject,at:item.respondedAt,read:false});state.events.push({id:crypto.randomUUID(),caseId:item.caseId,kind:'client_communication_responded',title:'Ratio ha respondido a tu solicitud',description:item.subject,at:item.respondedAt,current:true});saveState();}
    $('#communication-response-form').reset();$('#communication-response-dialog').close();renderShell();toast('Respuesta registrada y cliente avisado.');
  }catch(error){const messages={COMMUNICATION_ALREADY_RESPONDED:'Esta solicitud ya tiene respuesta.',COMMUNICATION_NOT_FOUND:'La solicitud ya no está disponible.',MFA_REQUIRED:'Confirma de nuevo el segundo factor.'};setModalFeedback('#communication-response-feedback',messages[error?.code]||'No se ha podido registrar la respuesta.');}
  finally{button.disabled=false;button.innerHTML=original;}
});

$('#password-form').addEventListener('submit',async event=>{
  event.preventDefault();const password=$('#new-password').value,confirmation=$('#confirm-password').value;
  if(password!==confirmation){toast('Las contraseñas no coinciden.');return;}
  const submitter=event.submitter;submitter.disabled=true;
  try{await platformApi.updatePassword(password);$('#password-form').reset();$('#password-dialog').close();await enterProduction();toast('Acceso confirmado correctamente.');}
  catch(error){toast(error?.code==='WEAK_PASSWORD'?'Usa al menos 12 caracteres, con mayúscula, minúscula, número y símbolo, sin espacios.':'No se ha podido confirmar el acceso.');}
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
    const invalidCode=['INVALID_MFA_CODE','mfa_verification_failed'].includes(error?.code);
    toast(invalidCode?'El código temporal no es válido o ha caducado. Abre tu app de autenticación e introduce el código nuevo que aparece.':'No se ha podido verificar el segundo factor. Inténtalo de nuevo.');
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

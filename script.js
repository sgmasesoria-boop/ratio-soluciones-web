const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
});

menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menu.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !menu?.classList.contains('open')) return;
  menu.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  menuButton?.focus();
});

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.08 });
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();

const form = document.getElementById('contact-form');
const steps = [...document.querySelectorAll('.form-step')];
const progress = document.querySelector('.form-progress');
const progressBars = [...document.querySelectorAll('.form-progress span')];
let currentStep = 1;

function showStep(number) {
  currentStep = number;
  steps.forEach((step) => {
    const active = Number(step.dataset.step) === number;
    step.hidden = !active;
    step.classList.toggle('active', active);
  });
  progressBars.forEach((bar, index) => bar.classList.toggle('active', index < number));
  progress?.setAttribute('aria-valuenow', String(number));
  form?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validateStep(number) {
  const step = steps.find((item) => Number(item.dataset.step) === number);
  if (!step) return true;
  for (const field of step.querySelectorAll('input, select, textarea')) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

document.querySelectorAll('.form-next').forEach((button) => button.addEventListener('click', () => {
  if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, steps.length));
}));

document.querySelectorAll('.form-back').forEach((button) => button.addEventListener('click', () => {
  showStep(Math.max(currentStep - 1, 1));
}));

const intakeEndpoint = 'https://bvpeztdfwdbiielaione.supabase.co/functions/v1/public-intake';
const supabasePublishableKey = 'sb_publishable_0Y0eIdsliv-v2TJ44xRGTw_hhRv0r5h';

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(2)) {
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-note');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando consulta…';
  }
  if (status) status.textContent = 'Registrando tu consulta de forma segura…';

  const data = new FormData(form);
  try {
    const response = await fetch(intakeEndpoint, {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullName: data.get('nombre'),
        email: data.get('email'),
        phone: data.get('telefono'),
        area: data.get('area'),
        consultation: data.get('consulta'),
        website: '',
        privacyNoticeAcknowledged: data.get('privacidad') === 'Información leída'
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok || !result.reference) throw new Error(result.error || `HTTP ${response.status}`);
    window.location.assign(`gracias.html?ref=${encodeURIComponent(result.reference)}`);
  } catch (error) {
    console.error('No se pudo registrar la consulta', error);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Volver a intentar <span>↗</span>';
    }
    if (status) status.innerHTML = 'No hemos podido registrar la consulta. Vuelve a intentarlo o escríbenos a <a href="mailto:clientes@ratiosoluciones.es">clientes@ratiosoluciones.es</a>.';
  }
});

const receiptReference = document.getElementById('consultation-reference');
if (receiptReference) {
  const reference = new URLSearchParams(window.location.search).get('ref') || '';
  if (/^C-[0-9]{4}-[A-Z0-9]{6}$/.test(reference)) {
    receiptReference.textContent = reference;
    receiptReference.closest('.receipt-reference')?.removeAttribute('hidden');
  }
}

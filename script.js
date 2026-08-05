const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menu.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-open');
  });
});

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}

document.getElementById('year').textContent = new Date().getFullYear();

const audienceTabs = [...document.querySelectorAll('.audience-tab')];
const audiencePanels = [...document.querySelectorAll('.audience-panel')];

function showAudience(audience) {
  audienceTabs.forEach((tab) => {
    const selected = tab.dataset.audience === audience;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });

  audiencePanels.forEach((panel) => {
    const selected = panel.id === `panel-${audience}`;
    panel.hidden = !selected;
    panel.classList.toggle('active', selected);
    if (selected) {
      panel.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
    }
  });
}

audienceTabs.forEach((tab) => tab.addEventListener('click', () => showAudience(tab.dataset.audience)));
document.querySelectorAll('[data-open-business]').forEach((link) => {
  link.addEventListener('click', () => showAudience('negocio'));
});

const areas = {
  personal: [
    'Deudas y segunda oportunidad',
    'Bancos, tarjetas y fraude',
    'Vivienda, alquiler o hipoteca',
    'Seguros e indemnizaciones',
    'Separación y familia',
    'Consumo y servicios',
    'Otro problema personal'
  ],
  negocio: [
    'Facturas pendientes e impagos',
    'Clientes, proveedores y contratos',
    'Deudas y financiación',
    'Notificaciones, trámites o sanciones',
    'Local, alquiler o propiedad',
    'Seguros y responsabilidad',
    'Otro problema del negocio'
  ]
};

const form = document.getElementById('contact-form');
const areaSelect = document.getElementById('area');
const typeRadios = [...document.querySelectorAll('input[name="tipo"]')];
const steps = [...document.querySelectorAll('.form-step')];
const progressBars = [...document.querySelectorAll('.form-progress span')];
let currentStep = 1;

function populateAreas(type, selectedValue = '') {
  areaSelect.innerHTML = '<option value="">Selecciona la situación más cercana</option>';
  areas[type].forEach((area) => {
    const option = document.createElement('option');
    option.value = area;
    option.textContent = area;
    option.selected = area === selectedValue;
    areaSelect.append(option);
  });
  areaSelect.disabled = false;
}

typeRadios.forEach((radio) => {
  radio.addEventListener('change', () => populateAreas(radio.dataset.value));
});

function showStep(number) {
  currentStep = number;
  steps.forEach((step) => {
    const active = Number(step.dataset.step) === number;
    step.hidden = !active;
    step.classList.toggle('active', active);
  });
  progressBars.forEach((bar, index) => bar.classList.toggle('active', index < number));
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function validateStep(stepNumber) {
  const step = steps.find((item) => Number(item.dataset.step) === stepNumber);
  const fields = [...step.querySelectorAll('input, select, textarea')];
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

document.querySelectorAll('.form-next').forEach((button) => {
  button.addEventListener('click', () => {
    if (validateStep(currentStep)) showStep(Math.min(currentStep + 1, 3));
  });
});

document.querySelectorAll('.form-back').forEach((button) => {
  button.addEventListener('click', () => showStep(Math.max(currentStep - 1, 1)));
});

document.querySelectorAll('.problem-card').forEach((card) => {
  card.addEventListener('click', () => {
    const type = card.dataset.type;
    const problem = card.dataset.problem;
    const radio = typeRadios.find((item) => item.dataset.value === type);
    if (radio) {
      radio.checked = true;
      populateAreas(type, problem);
      showStep(1);
    }
  });
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = new FormData(form);
  const message = [
    'Hola Ratio Soluciones. Quiero que estudiéis mi caso:',
    '',
    `Nombre: ${data.get('nombre')}`,
    `Mi número: ${data.get('whatsapp')}`,
    `Afecta a: ${data.get('tipo')}`,
    `Necesito resolver: ${data.get('area')}`,
    `Quién está al otro lado: ${data.get('contraparte')}`,
    `Punto actual: ${data.get('situacion')}`,
    `Existe un plazo: ${data.get('plazo')}`,
    `Objetivo: ${data.get('objetivo')}`,
    '',
    'Resumen:',
    data.get('mensaje')
  ].join('\n');

  window.location.href = `https://wa.me/34660918844?text=${encodeURIComponent(message)}`;
});

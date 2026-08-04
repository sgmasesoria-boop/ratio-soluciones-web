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

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.getElementById('year').textContent = new Date().getFullYear();

const areaSelect = document.getElementById('area');
const guidedQuestion = document.getElementById('guided-question');
const guidedLabel = document.getElementById('guided-label');
const guidedDetail = document.getElementById('guided-detail');
const guidedHelp = document.getElementById('guided-help');

const areaQuestions = {
  'Dinero, deudas y bancos': {
    label: '¿Con quién tienes el problema?',
    placeholder: 'Por ejemplo: banco, financiera, fondo buitre o empresa de recobro',
    help: 'No incluyas números de cuenta, tarjetas ni claves.'
  },
  'Vivienda, desahucios y ocupación': {
    label: '¿Qué está ocurriendo con la vivienda?',
    placeholder: 'Por ejemplo: impago, aviso de desahucio, alquiler, hipoteca u ocupación',
    help: 'Indica si existe una fecha próxima, pero no adjuntes documentos todavía.'
  },
  'Seguros e indemnizaciones': {
    label: '¿Qué ocurrió y qué respondió la aseguradora?',
    placeholder: 'Describe brevemente el siniestro, accidente o rechazo de la indemnización',
    help: 'No incluyas datos médicos ni números completos de póliza.'
  },
  'Separaciones y familia': {
    label: '¿Qué decisión o acuerdo necesitas abordar?',
    placeholder: 'Por ejemplo: separación, custodia, convenio o mediación',
    help: 'Evita nombres y datos personales de menores en este primer mensaje.'
  },
  'Reclamaciones y consumo': {
    label: '¿Contra quién quieres reclamar y por qué?',
    placeholder: 'Por ejemplo: compra, suministro, servicio, fraude o contrato incumplido',
    help: 'No compartas facturas ni datos bancarios hasta que te indiquemos cómo hacerlo.'
  },
  'Otro problema': {
    label: '¿Cómo explicarías el problema con tus propias palabras?',
    placeholder: 'No necesitas conocer el nombre técnico; cuéntanos qué te preocupa',
    help: 'Comparte solo la información imprescindible para una primera orientación.'
  }
};

areaSelect?.addEventListener('change', () => {
  const question = areaQuestions[areaSelect.value];
  guidedQuestion.hidden = !question;
  guidedDetail.required = Boolean(question);

  if (question) {
    guidedLabel.textContent = question.label;
    guidedDetail.placeholder = question.placeholder;
    guidedHelp.textContent = question.help;
  } else {
    guidedDetail.value = '';
  }
});

document.getElementById('contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = [
    'Hola Ratio Soluciones. He completado la consulta guiada:',
    '',
    `Nombre: ${data.get('nombre')}`,
    `Mi WhatsApp: ${data.get('whatsapp')}`,
    `Área: ${data.get('area')}`,
    `Información orientativa: ${data.get('detalle')}`,
    `Urgencia: ${data.get('urgencia')}`,
    `Qué necesito: ${data.get('objetivo')}`,
    '',
    'Situación:',
    data.get('mensaje')
  ].join('\n');
  window.location.href = `https://wa.me/34660918844?text=${encodeURIComponent(message)}`;
});


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

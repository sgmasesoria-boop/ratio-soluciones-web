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

document.getElementById('contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = `Consulta web - ${data.get('tipo')}`;
  const body = [
    `Nombre: ${data.get('nombre')}`,
    `Contacto: ${data.get('contacto')}`,
    `Tipo: ${data.get('tipo')}`,
    '',
    'Necesidad:',
    data.get('mensaje')
  ].join('\n');
  window.location.href = `mailto:sergio@ratiosoluciones.es?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

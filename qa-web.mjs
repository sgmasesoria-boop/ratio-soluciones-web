import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = process.cwd();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png', '.txt':'text/plain', '.xml':'application/xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const path = normalize(join(root, relative));
    if (!path.startsWith(root)) throw new Error('Invalid path');
    await stat(path);
    response.writeHead(200, { 'content-type': mime[extname(path)] || 'application/octet-stream' });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const browserPath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((path) => path && existsSync(path));
const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
const findings = [];

async function audit(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });

  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
    h1: document.querySelectorAll('h1').length,
    title: document.title,
    lang: document.documentElement.lang,
    oldDomain: document.documentElement.innerHTML.includes('ratio-soluciones-espana.sgmasesoria.chatgpt.site'),
    deadline: /menos de 24 horas/i.test(document.body.innerText)
  }));
  if (result.overflow) findings.push(`${viewport.width}px: desbordamiento horizontal ${result.width}/${result.viewport}`);
  if (result.h1 !== 1) findings.push(`${viewport.width}px: ${result.h1} encabezados H1`);
  if (result.lang !== 'es') findings.push(`${viewport.width}px: idioma incorrecto`);
  if (result.oldDomain) findings.push(`${viewport.width}px: referencia al dominio antiguo`);
  if (result.deadline) findings.push(`${viewport.width}px: sigue apareciendo el plazo de 24 horas`);
  if (errors.length) findings.push(`${viewport.width}px: errores de navegador: ${errors.join(' | ')}`);

  await page.locator('input[name="area"]').first().check();
  await page.locator('[data-step="1"] .form-next').click();
  await page.locator('select[name="situacion"]').selectOption({ index: 1 });
  await page.locator('[data-step="2"] .form-next').click();
  const contactState = await page.evaluate(() => ({
    emailRequired: document.querySelector('input[name="email"]').required,
    emailDisabled: document.querySelector('input[name="email"]').disabled,
    phoneRequired: document.querySelector('input[name="telefono"]').required,
    phoneDisabled: document.querySelector('input[name="telefono"]').disabled,
    preferredChannelPresent: Boolean(document.querySelector('[name="contacto_preferido"]')),
    taxCategoryPresent: Boolean(document.querySelector('input[name="area"][value="Hacienda e impuestos"]'))
  }));
  if (!contactState.taxCategoryPresent) findings.push('El formulario no incluye Hacienda e impuestos.');
  if (!contactState.emailRequired || contactState.emailDisabled || !contactState.phoneRequired || contactState.phoneDisabled || contactState.preferredChannelPresent) findings.push('El formulario no exige correctamente email y teléfono.');
  await page.close();
  return result;
}

const desktop = await audit({ width: 1440, height: 900 });
const mobile = await audit({ width: 390, height: 844 });

const htmlFiles = ['index.html','bancos.html','deudas.html','vivienda.html','seguros.html','familia.html','consumo.html','no-puedo-pagar-mis-deudas.html','tarjeta-deuda-no-baja.html','liquidacion-complementaria-hacienda.html','legal.html','gracias.html'];
for (const file of htmlFiles) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/${file}`, { waitUntil: 'networkidle' });
  const pageState = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    main: document.querySelectorAll('main').length
  }));
  if (pageState.overflow) findings.push(`${file}: desbordamiento horizontal en móvil`);
  if (file !== 'aviso-legal.html' && (pageState.h1 !== 1 || pageState.main !== 1)) findings.push(`${file}: estructura principal incorrecta`);
  if (errors.length) findings.push(`${file}: errores de navegador: ${errors.join(' | ')}`);
  await page.close();
}

for (const file of htmlFiles) {
  const html = await readFile(join(root, file), 'utf8');
  if (!/<meta name="robots"/i.test(html) && file === 'gracias.html') findings.push(`${file}: falta noindex`);
  if (!/<link rel="canonical"/i.test(html)) findings.push(`${file}: falta canonical`);
  if (file !== 'gracias.html' && !/<meta name="description"/i.test(html)) findings.push(`${file}: falta meta description`);
  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    if (!new RegExp(`id=["']${match[1]}["']`).test(html)) findings.push(`${file}: ancla inexistente #${match[1]}`);
  }
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|data:|#)/.test(href)) continue;
    const target = href.split('#')[0];
    try { await stat(join(root, target)); } catch { findings.push(`${file}: enlace interno roto ${href}`); }
  }
}

const worker = (await import(`./dist/server/index.js?qa=${Date.now()}`)).default;
const homeResponse = await worker.fetch(new Request('https://www.ratiosoluciones.es/'));
const imageResponse = await worker.fetch(new Request('https://www.ratiosoluciones.es/og-ratio-soluciones.png'));
const missingResponse = await worker.fetch(new Request('https://www.ratiosoluciones.es/no-existe'));
const policy = homeResponse.headers.get('content-security-policy') || '';
if (homeResponse.status !== 200 || !(await homeResponse.text()).includes('¿Tienes un problema?')) findings.push('El worker no sirve correctamente la portada.');
if (imageResponse.status !== 200 || imageResponse.headers.get('content-type') !== 'image/png' || (await imageResponse.arrayBuffer()).byteLength < 1000) findings.push('El worker no sirve correctamente la imagen social.');
if (missingResponse.status !== 404) findings.push('El worker no devuelve 404 para rutas inexistentes.');
if (policy.includes("'unsafe-inline'") || !policy.includes("object-src 'none'")) findings.push('La política CSP no tiene la configuración estricta prevista.');

await browser.close();
server.close();
const result = { passed: findings.length === 0, desktop, mobile, findings };
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;

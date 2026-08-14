import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const publicPages = [
  'index.html', 'deudas.html', 'bancos.html', 'vivienda.html',
  'seguros.html', 'familia.html', 'consumo.html', 'no-puedo-pagar-mis-deudas.html',
  'tarjeta-deuda-no-baja.html', 'liquidacion-complementaria-hacienda.html', 'legal.html'
];
const findings = [];
const canonicals = new Set();

function matches(html, pattern) {
  return [...html.matchAll(pattern)];
}

for (const file of publicPages) {
  const html = await readFile(join(root, file), 'utf8');
  const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim() || '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim() || '';
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1] || '';
  const h1Count = matches(html, /<h1(?:\s|>)/gi).length;

  if (!title || title.length < 25 || title.length > 60) findings.push(`${file}: título fuera del intervalo recomendado de 25-60 caracteres (${title.length}).`);
  if (!description || description.length < 70 || description.length > 160) findings.push(`${file}: descripción fuera del intervalo recomendado de 70-160 caracteres (${description.length}).`);
  if (h1Count !== 1) findings.push(`${file}: debe tener un único H1 y tiene ${h1Count}.`);
  if (!canonical.startsWith('https://www.ratiosoluciones.es/')) findings.push(`${file}: canonical ausente o incorrecto.`);
  if (canonicals.has(canonical)) findings.push(`${file}: canonical duplicado (${canonical}).`);
  canonicals.add(canonical);

  for (const image of matches(html, /<img\b[^>]*>/gi)) {
    if (!/\salt=("[^"]*"|'[^']*')/i.test(image[0])) findings.push(`${file}: imagen sin atributo alt.`);
  }
  for (const link of matches(html, /href="([^"]+)"/gi)) {
    const href = link[1];
    if (/^(?:https?:|mailto:|#|data:)/i.test(href)) continue;
    const target = href.split(/[?#]/)[0];
    if (!target) continue;
    try { await stat(join(root, target)); } catch { findings.push(`${file}: enlace interno roto (${href}).`); }
  }
}

const index = await readFile(join(root, 'index.html'), 'utf8');
for (const tag of ['og:title', 'og:description', 'og:url', 'og:image']) {
  if (!index.includes(`property="${tag}"`)) findings.push(`index.html: falta ${tag}.`);
}
if (!index.includes('application/ld+json')) findings.push('index.html: faltan datos estructurados JSON-LD.');

const robots = await readFile(join(root, 'robots.txt'), 'utf8');
if (!/User-agent:\s*\*/i.test(robots) || !/Sitemap:\s*https:\/\/www\.ratiosoluciones\.es\/sitemap\.xml/i.test(robots)) findings.push('robots.txt: configuración incompleta.');

const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
for (const canonical of canonicals) {
  if (!sitemap.includes(`<loc>${canonical}</loc>`)) findings.push(`sitemap.xml: falta ${canonical}.`);
}

const thanks = await readFile(join(root, 'gracias.html'), 'utf8');
if (!/<meta\s+name="robots"\s+content="noindex,follow"/i.test(thanks)) findings.push('gracias.html: falta noindex,follow.');

const build = await readFile(join(root, 'build.mjs'), 'utf8');
if (!build.includes("url.hostname === 'ratiosoluciones.es'") || !build.includes("url.hostname = 'www.ratiosoluciones.es'") || !build.includes('Response.redirect(url.toString(), 301)')) {
  findings.push('build.mjs: falta la redirección 301 del dominio raíz hacia www.');
}

const result = { passed: findings.length === 0, pages: publicPages.length, findings };
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;

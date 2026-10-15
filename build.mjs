import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const textFiles = [
  'index.html', 'bancos.html', 'deudas.html', 'vivienda.html', 'seguros.html',
  'familia.html', 'no-puedo-pagar-mis-deudas.html', 'tarjeta-deuda-no-baja.html',
  'legal.html', 'aviso-legal.html', 'gracias.html', 'styles.css', 'script.js',
  'robots.txt', 'sitemap.xml', 'favicon.svg', 'og-ratio-soluciones.svg', 'CNAME'
];
const binaryFiles = ['og-ratio-soluciones.png'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

for (const file of textFiles) await cp(file, `dist/${file}`);
for (const file of binaryFiles) await cp(file, `dist/${file}`);
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

const contentTypes = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8', svg: 'image/svg+xml; charset=utf-8'
};
const routes = {};
for (const file of textFiles.filter((name) => !['CNAME'].includes(name))) {
  const extension = file.split('.').pop();
  routes[`/${file}`] = { body: await readFile(file, 'utf8'), contentType: contentTypes[extension] };
}
for (const file of binaryFiles) {
  routes[`/${file}`] = { bodyBase64: (await readFile(file)).toString('base64'), contentType: 'image/png' };
}
routes['/'] = routes['/index.html'];
for (const page of ['bancos','deudas','vivienda','seguros','familia','no-puedo-pagar-mis-deudas','tarjeta-deuda-no-baja','legal','aviso-legal','gracias']) {
  routes[`/${page}`] = routes[`/${page}.html`];
}

const worker = `const routes = ${JSON.stringify(routes)};
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.hostname === 'ratiosoluciones.es') {
    url.hostname = 'www.ratiosoluciones.es';
    return Response.redirect(url.toString(), 301);
  }
  const route = routes[url.pathname.replace(/\\/$/, '') || '/'];
  if (!route) return new Response('Página no encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const headers = {
    'content-type': route.contentType,
    'cache-control': route.contentType.startsWith('text/html') || route.contentType.startsWith('text/javascript') ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'cross-origin-opener-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://bvpeztdfwdbiielaione.supabase.co; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
  };
  const body = route.bodyBase64 ? Uint8Array.from(atob(route.bodyBase64), (character) => character.charCodeAt(0)) : route.body;
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}};`;
await writeFile('dist/server/index.js', worker, 'utf8');
console.log(`Built ${textFiles.length + binaryFiles.length} public files and ${Object.keys(routes).length} routes.`);

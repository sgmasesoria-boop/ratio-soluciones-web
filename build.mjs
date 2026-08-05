import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const textFiles = [
  'index.html', 'bancos.html', 'deudas.html', 'vivienda.html', 'seguros.html',
  'familia.html', 'consumo.html', 'legal.html', 'aviso-legal.html', 'styles.css', 'script.js',
  'robots.txt', 'sitemap.xml', 'CNAME'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

for (const file of textFiles) await cp(file, `dist/${file}`);
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

const contentTypes = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8'
};
const routes = {};
for (const file of textFiles.filter((name) => !['CNAME'].includes(name))) {
  const extension = file.split('.').pop();
  routes[`/${file}`] = { body: await readFile(file, 'utf8'), contentType: contentTypes[extension] };
}
routes['/'] = routes['/index.html'];
for (const page of ['bancos','deudas','vivienda','seguros','familia','consumo','legal','aviso-legal']) {
  routes[`/${page}`] = routes[`/${page}.html`];
}

const worker = `const routes = ${JSON.stringify(routes)};
export default { async fetch(request) {
  const url = new URL(request.url);
  const route = routes[url.pathname.replace(/\\/$/, '') || '/'];
  if (!route) return new Response('Página no encontrada', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const headers = {
    'content-type': route.contentType,
    'cache-control': route.contentType.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me"
  };
  return new Response(request.method === 'HEAD' ? null : route.body, { status: 200, headers });
}};`;
await writeFile('dist/server/index.js', worker, 'utf8');
console.log(`Built ${textFiles.length} public files and ${Object.keys(routes).length} routes.`);

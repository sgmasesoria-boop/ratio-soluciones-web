import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const files = [
  'index.html',
  'styles.css',
  'script.js',
  'aviso-legal.html',
  'CNAME'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });

for (const file of files) {
  await cp(file, `dist/${file}`);
}

await cp('.openai/hosting.json', 'dist/.openai/hosting.json');

const contentTypes = {
  'index.html': 'text/html; charset=utf-8',
  'aviso-legal.html': 'text/html; charset=utf-8',
  'styles.css': 'text/css; charset=utf-8',
  'script.js': 'text/javascript; charset=utf-8'
};

const routes = {};
for (const file of Object.keys(contentTypes)) {
  routes[`/${file}`] = {
    body: await readFile(file, 'utf8'),
    contentType: contentTypes[file]
  };
}
routes['/'] = routes['/index.html'];

const worker = `const routes = ${JSON.stringify(routes)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const route = routes[url.pathname];

    if (!route) {
      return new Response('Página no encontrada', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }

    return new Response(request.method === 'HEAD' ? null : route.body, {
      status: 200,
      headers: {
        'content-type': route.contentType,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin'
      }
    });
  }
};
`;

await writeFile('dist/server/index.js', worker, 'utf8');
console.log(`Built ${files.length} static files and Cloudflare Worker entrypoint in dist/`);


import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const platform = join(root, 'platform');
const results = [];
function run(name, args, cwd = root) {
  const result = spawnSync(process.execPath, args, { cwd, encoding:'utf8', timeout:120000 });
  const ok = result.status === 0 && !result.error;
  results.push({name, ok});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) console.error(result.error?.message || result.stderr || result.stdout);
  return ok;
}
run('offline browser guard', ['qa-browser.test.mjs']);
run('web build', ['build.mjs']);
for (const name of ['qa-web.mjs', 'intake-flow-qa.mjs', 'seo-audit.mjs']) run(name, [name]);
for (const mode of ['crm', 'portal']) run(`build ${mode}`, ['build.mjs', mode], platform);
const tests = readdirSync(platform).filter(name =>
  !name.includes('live') && (name.endsWith('-qa.mjs') || ['qa.mjs', 'qa-modes.mjs'].includes(name))).sort();
for (const name of tests) {
  if (!run(`build before ${name}`, ['build.mjs'], platform)) continue;
  const args = [name];
  if (name === 'document-export-qa.mjs') {
    // A new path keeps prior QA outputs intact.
    mkdirSync(join(platform, '.qa-document-export'), {recursive:true});
    args.push(join('.qa-document-export', `offline-${Date.now()}-${process.pid}`));
  }
  run(name, args, platform);
}
run('final platform build', ['build.mjs'], platform);
const failures = results.filter(item => !item.ok);
console.log(JSON.stringify({checks:results.length, failures}, null, 2));
process.exitCode = failures.length ? 1 : 0;

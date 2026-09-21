import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Build all three applications from one checkout without publishing or accessing APIs.
const root = fileURLToPath(new URL('.', import.meta.url));
const output = join(root, '.ratio-releases');
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (revision.status !== 0) throw new Error('Cannot identify source revision.');
const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
if (status.status !== 0) throw new Error('Cannot inspect source status.');
await mkdir(output, { recursive: true });
const destination = join(output, `${Date.now()}-${process.pid}`);
await mkdir(destination); // Never reuse or erase a previous release.
const manifest = {
  revision: revision.stdout.trim(),
  sourceHasChanges: Boolean(status.stdout.trim()),
  createdAt: new Date().toISOString(),
  status: 'building',
  runtime: 'production',
  warning: 'Not deployed or live-validated. Opening these applications can contact configured services.',
  applications: [],
};
const save = () => writeFile(join(destination, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
await save();
try {
  for (const mode of ['web', 'crm', 'portal']) {
    const cwd = mode === 'web' ? root : join(root, 'platform');
    const args = mode === 'web' ? ['build.mjs'] : ['build.mjs', mode];
    const built = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 120000 });
    if (built.status !== 0 || built.error) throw new Error(`Build failed: ${mode}.`);
    const artifact = join(destination, mode);
    await cp(join(cwd, 'dist'), artifact, { recursive: true, errorOnExist: true, force: false });
    const hosting = JSON.parse(await readFile(join(artifact, '.openai', 'hosting.json'), 'utf8'));
    manifest.applications.push({ mode, directory: mode, originalProjectId: hosting.project_id });
    await save();
  }
  manifest.status = 'built-not-deployed';
  await save();
  console.log(`Prepared web, CRM and portal in ${destination}`);
  console.log('Original hosting identities preserved. No deployment or service connection performed.');
} catch (error) {
  manifest.status = 'failed-do-not-deploy';
  await save();
  throw error;
}

import { spawn } from 'node:child_process';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptBuffer, decryptBuffer } from './storage-backup.mjs';

// Copia lógica cifrada de la base de datos Postgres de Supabase (pg_dump --format=custom)
// y restauración verificada en una instancia aislada. Nunca contra producción.
//
// Reutiliza el mismo esquema de cifrado que storage-backup.mjs (AES-256-GCM + scrypt)
// para mantener un único estándar criptográfico en todas las copias de Ratio.

const EXPECTED_PROJECT_REF = 'bvpeztdfwdbiielaione';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deriveKey(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 20) throw new Error('BACKUP_PASSPHRASE_TOO_SHORT');
  // Mismos parámetros de coste que storage-backup.mjs: deben coincidir para que ambas
  // copias sigan el mismo estándar, aunque cada una deriva su propia clave con su propia sal.
  return scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function externalDestination(path) {
  const destination = resolve(path);
  const workspace = resolve(process.cwd());
  const rel = relative(workspace, destination);
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('BACKUP_DESTINATION_MUST_BE_OUTSIDE_WORKSPACE');
  return destination;
}

function assertSupabasePoolerHost(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('INVALID_CONNECTION_STRING');
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') throw new Error('CONNECTION_STRING_MUST_BE_POSTGRES');
  if (!parsed.hostname.includes(EXPECTED_PROJECT_REF)) throw new Error('UNEXPECTED_SUPABASE_PROJECT');
  return parsed;
}

function runCommand(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', (error) => rejectPromise(new Error(`${command}_SPAWN_FAILED: ${error.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`${command}_EXIT_${code}: ${Buffer.concat(stderrChunks).toString('utf8').slice(0, 2000)}`));
        return;
      }
      resolvePromise(Buffer.concat(stdoutChunks));
    });
  });
}

export async function createDatabaseBackup({ connectionString, passphrase, output, pgDumpPath = 'pg_dump' }) {
  assertSupabasePoolerHost(connectionString);
  const root = externalDestination(output);
  await mkdir(root, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(root, `ratio-db-${stamp}`);
  await mkdir(target, { recursive: false });

  // pg_dump --format=custom produce un volcado binario comprimido, restaurable selectivamente
  // con pg_restore y sin necesidad de psql intermedio.
  const dump = await runCommand(pgDumpPath, [
    connectionString,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--schema=public',
    '--schema=storage',
    '--exclude-table-data=storage.objects',
  ]);

  const salt = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  try {
    const encrypted = encryptBuffer(dump, key, 'ratio-db-dump-v1');
    await writeFile(join(target, 'dump.enc'), encrypted, { flag: 'wx' });
    const index = {
      version: 1,
      projectRef: EXPECTED_PROJECT_REF,
      createdAt: new Date().toISOString(),
      dumpFormat: 'pg_dump-custom',
      dumpBytesClear: dump.length,
      dumpSha256: sha256(dump),
      salt: salt.toString('base64'),
      encryptedSha256: sha256(encrypted),
    };
    await writeFile(join(target, 'backup.json'), JSON.stringify(index, null, 2), { encoding: 'utf8', flag: 'wx' });
    return { target, bytes: dump.length, sha256: index.dumpSha256 };
  } finally {
    dump.fill(0);
    key.fill(0);
  }
}

export async function verifyDatabaseBackup({ passphrase, target, pgRestorePath = 'pg_restore' }) {
  const root = resolve(target);
  const index = JSON.parse(await readFile(join(root, 'backup.json'), 'utf8'));
  if (index.version !== 1 || index.projectRef !== EXPECTED_PROJECT_REF) throw new Error('INVALID_BACKUP_INDEX');
  const encrypted = await readFile(join(root, 'dump.enc'));
  if (sha256(encrypted) !== index.encryptedSha256) throw new Error('ENCRYPTED_FILE_HASH_MISMATCH');
  const key = deriveKey(passphrase, Buffer.from(index.salt, 'base64'));
  let dump;
  try {
    dump = decryptBuffer(encrypted, key, 'ratio-db-dump-v1');
    if (dump.length !== index.dumpBytesClear || sha256(dump) !== index.dumpSha256) throw new Error('DUMP_INTEGRITY_MISMATCH');
    // Comprueba que el volcado es un pg_dump custom válido sin restaurarlo todavía:
    // pg_restore --list solo lee la tabla de contenidos, no aplica nada a ninguna base.
    const tmpDir = join(root, '.verify-tmp');
    await mkdir(tmpDir, { recursive: true });
    const tmpDumpPath = join(tmpDir, 'dump.custom');
    await writeFile(tmpDumpPath, dump, { flag: 'wx' });
    try {
      const listing = await runCommand(pgRestorePath, ['--list', tmpDumpPath]);
      const entries = listing
        .toString('utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0 && !line.startsWith(';'));
      return { verified: true, createdAt: index.createdAt, bytes: dump.length, tocEntries: entries.length };
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  } finally {
    if (dump) dump.fill(0);
    key.fill(0);
  }
}

export async function restoreToIsolatedInstance({ dumpPath, targetConnectionString, pgRestorePath = 'pg_restore' }) {
  // Salvaguarda dura: nunca acepta el proyecto de producción como destino de restauración.
  const parsedTarget = new URL(targetConnectionString);
  if (parsedTarget.hostname.includes(EXPECTED_PROJECT_REF)) {
    throw new Error('REFUSED_RESTORE_TARGET_IS_PRODUCTION_PROJECT');
  }
  await runCommand(pgRestorePath, [
    `--dbname=${targetConnectionString}`,
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
    dumpPath,
  ]);
  return { restored: true, target: parsedTarget.hostname };
}

export function cryptoSelfTest() {
  const salt = Buffer.alloc(16, 9);
  const key = deriveKey('prueba-segura-no-usar-654321', salt);
  try {
    const clear = Buffer.from('VOLCADO FICTICIO DE PRUEBA RATIO');
    const encrypted = encryptBuffer(clear, key, 'ratio-db-dump-v1');
    const recovered = decryptBuffer(encrypted, key, 'ratio-db-dump-v1');
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 1;
    let tamperBlocked = false;
    try {
      decryptBuffer(tampered, key, 'ratio-db-dump-v1');
    } catch {
      tamperBlocked = true;
    }
    return recovered.equals(clear) && !encrypted.includes(clear) && tamperBlocked;
  } finally {
    key.fill(0);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'self-test') {
    if (!cryptoSelfTest()) throw new Error('CRYPTO_SELF_TEST_FAILED');
    console.log(JSON.stringify({ passed: true }));
    return;
  }
  const option = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : '';
  };
  if (command === 'create') {
    const result = await createDatabaseBackup({
      connectionString: process.env.RATIO_SUPABASE_DB_URL || '',
      passphrase: process.env.RATIO_BACKUP_PASSPHRASE || '',
      output: option('--output'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'verify') {
    const result = await verifyDatabaseBackup({
      passphrase: process.env.RATIO_BACKUP_PASSPHRASE || '',
      target: option('--target'),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (command === 'restore-isolated') {
    const result = await restoreToIsolatedInstance({
      dumpPath: option('--dump'),
      targetConnectionString: process.env.RATIO_RESTORE_TEST_DB_URL || '',
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(
    'USAGE: db-backup.mjs create --output <external-folder> | verify --target <backup-folder> | restore-isolated --dump <path-to-decrypted-dump> | self-test'
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

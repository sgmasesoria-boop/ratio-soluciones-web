import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {platformOfflineTests} from './qa-offline-tests.mjs';
assert.equal(new Set(platformOfflineTests).size, platformOfflineTests.length);
for (const name of platformOfflineTests) {
  assert.doesNotMatch(name, /live|invite|[/\\]/i);
  await access(new URL(`./platform/${name}`, import.meta.url));
}
assert.ok(platformOfflineTests.includes('database-backup-qa.mjs'));
assert.ok(platformOfflineTests.includes('storage-backup-qa.mjs'));
console.log('Offline selection: explicit suites, no invitation/live discovery.');

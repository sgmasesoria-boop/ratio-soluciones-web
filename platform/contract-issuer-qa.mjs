import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contractIssuer, contractReplyTo} from './supabase/functions/contract-signature/issuer.ts';

const fixture = {
  RATIO_CONTRACT_ISSUER_NAME: 'Entidad ficticia de pruebas',
  RATIO_CONTRACT_ISSUER_IDENTIFIER: 'TEST-ID',
  RATIO_CONTRACT_ISSUER_ADDRESS: 'Domicilio ficticio para QA',
  RATIO_CONTRACT_REPLY_TO: 'contracts@example.invalid',
};
const get = name => fixture[name];
assert.deepEqual(contractIssuer(get), {name:fixture.RATIO_CONTRACT_ISSUER_NAME, identifier:'TEST-ID', address:fixture.RATIO_CONTRACT_ISSUER_ADDRESS});
assert.equal(contractReplyTo(get), 'contracts@example.invalid');
for (const name of Object.keys(fixture)) {
  const action = name.endsWith('REPLY_TO') ? contractReplyTo : contractIssuer;
  for (const bad of [undefined, '', '   ', 'bad\nvalue', 'x'.repeat(500)]) {
    assert.throws(() => action(key => key === name ? bad : get(key)), {message:'CONTRACT_ISSUER_NOT_CONFIGURED'});
  }
}
assert.throws(() => contractReplyTo(() => 'not-an-email'), {message:'CONTRACT_ISSUER_NOT_CONFIGURED'});
const source = await readFile(new URL('./supabase/functions/contract-signature/index.ts', import.meta.url), 'utf8');
assert.match(source, /contractIssuer\(name=>Deno.env.get\(name\)\)/);
assert.match(source, /\$\{issuer.name\}.*\$\{issuer.identifier\}.*\$\{issuer.address\}/);
assert.match(source, /form.append\('reply_to',replyTo\)/);
assert.doesNotMatch(source, /\b\d{8}[A-Z]\b|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
console.log('Contract issuer QA: explicit configuration, missing/invalid values rejected, no embedded identity or reply-to.');

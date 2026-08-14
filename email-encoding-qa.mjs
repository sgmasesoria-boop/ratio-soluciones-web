import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const files=[
  'platform/supabase/functions/public-intake/index.ts',
  'platform/supabase/functions/_shared/case-email.ts',
  'platform/supabase/functions/_shared/case-update-email.ts',
  'platform/supabase/functions/_shared/document-email.ts',
  'platform/supabase/functions/_shared/document-upload-email.ts',
  'platform/supabase/functions/_shared/communication-email.ts'
];

for(const file of files){
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  assert.equal(source.includes('Ã'),false,`${file}: contiene texto UTF-8 corrupto`);
  const messages=source.split(/\.sendMail\(\{/u).slice(1);
  assert.ok(messages.length>0,`${file}: no contiene envíos SMTP`);
  for(const message of messages){
    assert.match(message.slice(0,220),/encoding:'base64'/u,`${file}: falta codificación MIME explícita`);
  }
}

const intake=await readFile(new URL('platform/supabase/functions/public-intake/index.ts',import.meta.url),'utf8');
assert.match(intake,/Hemos recibido tu consulta/u);
assert.match(intake,/contacto contigo/u);
assert.match(intake,/datos que nos has facilitado/u);
assert.match(intake,/te indicaremos cómo continuar/u);
assert.doesNotMatch(intake,/\busted(?:es)?\b/iu);

console.log('Email encoding QA passed: UTF-8 protegido y tratamiento de tú verificado.');

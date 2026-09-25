// contact.test.ts
// Run with:  npm run test:contact

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContact } from './contact.ts';

test('a normal message passes, trimmed', () => {
  const r = checkContact({ name: ' Ada ', email: 'ada@example.com', topic: 'Bug report', message: ' It broke. ', company: '' });
  assert.deepEqual(r, { ok: true, value: { name: 'Ada', email: 'ada@example.com', topic: 'Bug report', message: 'It broke.' } });
});

test('a filled honeypot is spam', () => {
  assert.deepEqual(checkContact({ email: 'a@b.co', message: 'hello there', company: 'Acme' }), { ok: false, spam: true });
});

test('a bad email or empty message is rejected with a reason', () => {
  const noEmail = checkContact({ email: 'nope', message: 'hello there' });
  assert.equal(noEmail.ok, false);
  const noMessage = checkContact({ email: 'a@b.co', message: '  ' });
  assert.equal(noMessage.ok, false);
  if (!noMessage.ok) assert.equal(noMessage.spam, false);
});

test('an unknown topic becomes Other, oversize text is refused', () => {
  const r = checkContact({ email: 'a@b.co', message: 'hello there', topic: 'Buy crypto' });
  assert.ok(r.ok && r.value.topic === 'Other');
  assert.equal(checkContact({ email: 'a@b.co', message: 'x'.repeat(5001) }).ok, false);
});

test('non-string fields are treated as empty', () => {
  assert.equal(checkContact({ email: 42, message: ['hi'] }).ok, false);
});

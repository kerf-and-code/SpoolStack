// retry-title.test.ts
// Run with:  npm run test:retry-title

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TITLE_MAX, nextRetryTitle, retryBase, retryNumber, retryTitlePattern } from './retry-title.ts';

test('first retry of a plain title', () => {
  assert.equal(nextRetryTitle('Tankard v1.5', []), 'Tankard v1.5 (retry 1)');
});

test('a second retry of the same original counts the first', () => {
  assert.equal(nextRetryTitle('Tankard v1.5', ['Tankard v1.5 (retry 1)']), 'Tankard v1.5 (retry 2)');
});

test('retrying a retry continues the count instead of stacking suffixes', () => {
  assert.equal(nextRetryTitle('Tankard v1.5 (retry 1)', []), 'Tankard v1.5 (retry 2)');
});

test('the highest number in use wins, wherever it is', () => {
  const existing = ['Tankard v1.5 (retry 1)', 'Tankard v1.5 (retry 4)', 'tankard v1.5 (retry 2)'];
  assert.equal(nextRetryTitle('Tankard v1.5 (retry 1)', existing), 'Tankard v1.5 (retry 5)');
});

test('titles for other bases are ignored', () => {
  assert.equal(nextRetryTitle('Tankard', ['Tankard lid (retry 7)', 'Tankard v2 (retry 3)']), 'Tankard (retry 1)');
});

test('nothing to build on gives an empty title', () => {
  assert.equal(nextRetryTitle('', []), '');
  assert.equal(nextRetryTitle('   ', []), '');
  assert.equal(nextRetryTitle('(retry 2)', []), '');
});

test('never longer than the form allows, suffix kept', () => {
  const long = 'x'.repeat(200);
  const t = nextRetryTitle(long, []);
  assert.equal(t.length, TITLE_MAX);
  assert.ok(t.endsWith(' (retry 1)'));
});

test('base and number parsing', () => {
  assert.equal(retryBase('Benchy (Retry 3) '), 'Benchy');
  assert.equal(retryNumber('Benchy (retry 12)'), 12);
  assert.equal(retryNumber('Benchy (retry 12) final'), 0);
  assert.equal(retryBase('Benchy (retry 12) final'), 'Benchy (retry 12) final');
});

test('LIKE wildcards in the base are escaped', () => {
  assert.equal(retryTitlePattern('50% infill_v2'), '50\\% infill\\_v2 (retry %)');
});

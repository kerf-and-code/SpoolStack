// photos.test.ts
// Run with:  npm run test:photos

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPhotoKind, fitWithin, isOwnPhotoPath, isPhotoKind, photoPath } from './photos.ts';

const U = '11111111-1111-1111-1111-111111111111';
const R = 'dddddddd-0000-0000-0000-000000000001';
const P = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test('paths are built and checked the way the Storage policy expects', () => {
  const p = photoPath(U, R, P);
  assert.equal(p, `${U}/${R}/${P}.jpg`);
  assert.equal(isOwnPhotoPath(p, U, R), true);
});

test('a path in another folder, run or shape is refused', () => {
  const other = '22222222-2222-2222-2222-222222222222';
  assert.equal(isOwnPhotoPath(photoPath(other, R, P), U, R), false);
  assert.equal(isOwnPhotoPath(photoPath(U, other, P), U, R), false);
  assert.equal(isOwnPhotoPath(`${U}/${R}/../${P}.jpg`, U, R), false);
  assert.equal(isOwnPhotoPath(`${U}/${R}/${P}.png`, U, R), false);
  assert.equal(isOwnPhotoPath(`${U}/${R}/x.jpg`, U, R), false);
});

test('shrinking keeps the aspect ratio and never enlarges', () => {
  assert.deepEqual(fitWithin(4032, 3024), { width: 2048, height: 1536 });
  assert.deepEqual(fitWithin(3024, 4032), { width: 1536, height: 2048 });
  assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
});

test('a failed run preselects the failure kind', () => {
  assert.equal(defaultPhotoKind('failure'), 'failure');
  assert.equal(defaultPhotoKind('partial'), 'failure');
  assert.equal(defaultPhotoKind('success'), 'overview');
  assert.equal(defaultPhotoKind(null), 'overview');
});

test('only known kinds pass', () => {
  assert.equal(isPhotoKind('closeup'), true);
  assert.equal(isPhotoKind('selfie'), false);
  assert.equal(isPhotoKind(3), false);
});

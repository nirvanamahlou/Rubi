import test from 'node:test';
import assert from 'node:assert/strict';
import { findSources, sourceCards } from './source-discovery.mjs';
const sources = [
  'contracts',
  'payments',
  'passengers',
  'amounts',
  'services',
].map((id) => ({ id }));
test('discovery only ranks authorized semantics, without payload data', () => {
  assert.deepEqual(
    sourceCards(
      'وصول',
      sources.filter((s) => s.id !== 'payments'),
    ),
    [],
  );
  assert.deepEqual(
    findSources('تعداد كودكان مسافر', sources).map((s) => s.id),
    ['passengers'],
  );
  assert.deepEqual(
    findSources('discount', sources).map((s) => s.id),
    ['amounts'],
  );
  assert.deepEqual(findSources('نامشخص', sources), []);
  assert.equal(
    findSources('قرارداد مبلغ پرداخت مسافر بیمه', sources).length,
    3,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyQuery } from '../src/query.js';

const rows = [5, 4, 3, 2, 1].map(value => ({ id: String.fromCharCode(96 + value), data: { value, company: `Company ${value}` } }));

test('query applies cursor before page limit for descending results', () => {
  const page = applyQuery(rows, [
    { type: 'orderBy', field: 'value', direction: 'desc' },
    { type: 'startAfter', id: 'c' },
    { type: 'limit', count: 2 },
  ]);
  assert.deepEqual(page.map(row => row.data.value), [2, 1]);
});

test('query supports prefix ranges and ascending pagination', () => {
  const sample = [
    { id: '1', data: { company: 'Alpha LLC' } },
    { id: '2', data: { company: 'Beta LLC' } },
    { id: '3', data: { company: 'Bravo LLC' } },
    { id: '4', data: { company: 'Charlie LLC' } },
  ];
  const page = applyQuery(sample, [
    { type: 'orderBy', field: 'company' },
    { type: 'startAt', value: 'B' },
    { type: 'endAt', value: 'B\uf8ff' },
    { type: 'startAfter', id: '2' },
    { type: 'limit', count: 5 },
  ]);
  assert.deepEqual(page.map(row => row.data.company), ['Bravo LLC']);
});

test('query filters before sorting and supports membership filters', () => {
  const filtered = applyQuery(rows, [
    { type: 'where', field: 'value', op: 'in', value: [2, 4] },
    { type: 'orderBy', field: 'value' },
  ]);
  assert.deepEqual(filtered.map(row => row.data.value), [2, 4]);
});

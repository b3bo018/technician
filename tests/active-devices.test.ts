import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_DEVICE_MODELS, DEVICE_MODELS, emptyStock } from '../src/types';

test('LV02 is removed from active stock while historical model data remains supported', () => {
  assert.equal(ACTIVE_DEVICE_MODELS.includes('LV02' as any), false);
  assert.equal(DEVICE_MODELS.includes('LV02'), true);
  assert.equal(emptyStock().LV02, 0);
});

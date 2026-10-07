import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPushEndpoint, enqueuePush, pushEndpointHash } from '../src/push.js';
import type { Pool } from 'pg';

test('accepts only HTTPS endpoints for the self-hosted server and non-Google browser push gateways', () => {
  assert.equal(allowedPushEndpoint('https://push.securetrackgo.com/up/example'), true);
  assert.equal(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), false);
  assert.equal(allowedPushEndpoint('http://push.securetrackgo.com/up/example'), false);
  assert.equal(allowedPushEndpoint('https://127.0.0.1:8080/'), false);
  assert.equal(allowedPushEndpoint('https://evilconnect.securetrackgo.com/'), false);
  assert.equal(allowedPushEndpoint('https://connect.securetrackgo.com.attacker.invalid/'), false);
  assert.equal(allowedPushEndpoint('https://user:password@push.securetrackgo.com/'), false);
});

test('subscription endpoint identifiers are stable one-way hashes', () => {
  const first = pushEndpointHash('https://push.securetrackgo.com/up/random');
  assert.equal(first, pushEndpointHash('https://push.securetrackgo.com/up/random'));
  assert.notEqual(first, pushEndpointHash('https://push.securetrackgo.com/up/other'));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('new push events also create an AWS-backed, recipient-scoped in-app notice', async () => {
  const statements: Array<{ sql: string; params: any[] }> = [];
  const fakePool = { query: async (sql: string, params: any[] = []) => {
    statements.push({ sql, params });
    return sql.includes('INSERT INTO push_outbox') ? { rows: [{ id: 1 }], rowCount: 1 } : { rows: [], rowCount: 1 };
  } };
  await enqueuePush(fakePool as unknown as Pool, 'hr-1', 'late-clock-in:2026-01-01', {
    title: 'Late clock-in', body: 'Technician has not clocked in.', url: '/?section=workforce',
  });
  assert.equal(statements.length, 2);
  assert.match(statements[1].sql, /INSERT INTO documents/);
  assert.equal(statements[1].params[1].recipient_uids[0], 'hr-1');
  assert.equal(statements[1].params[1].recipient_roles.length, 0);
  assert.equal(statements[1].params[1].target_section, 'workforce');
});

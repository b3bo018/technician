import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPushEndpoint, pushEndpointHash } from '../src/push.js';

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

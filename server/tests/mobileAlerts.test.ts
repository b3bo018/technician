import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { syncMobileAlerts } from '../src/mobileAlerts.js';

const deviceId = 'a0000000-0000-4000-8000-000000000000';
function fake(fail = false) {
  const queries: Array<{sql: string; params: any[]}> = [];
  let released = false;
  const client = { query: async (sql: string, params: any[] = []) => {
    queries.push({sql, params});
    if (fail && sql.includes('SELECT p.id')) throw new Error('DB unavailable');
    return {rows: sql.includes('SELECT p.id') ? [{id:'8',title:'New job',body:'Open X OPS',url:'/'}] : []};
  }, release: () => { released = true; } };
  return {pool: {connect: async () => client} as unknown as Pool, queries, released: () => released};
}
test('receipts and replay are scoped to the verified user and this installation', async () => {
  const db = fake();
  const result = await syncMobileAlerts(db.pool, 'verified-user', {deviceId,ack:['7'],uid:'other-user'});
  assert.equal(result.notifications[0].id,'8');
  const receipts = db.queries.find(q=>q.sql.includes('INSERT INTO mobile_alert_receipts'))!;
  assert.deepEqual(receipts.params,['verified-user',deviceId,['7']]);
  assert.match(receipts.sql,/WHERE user_id=\$1/);
  const replay = db.queries.find(q=>q.sql.includes('SELECT p.id'))!;
  assert.deepEqual(replay.params,['verified-user',deviceId]);
  assert.match(replay.sql,/NOT EXISTS/);
  assert.doesNotMatch(replay.sql,/sent_at IS NULL/); // Other delivery transports cannot consume mobile replay.
  assert.equal(db.queries.at(-1)?.sql,'COMMIT');
  assert.equal(db.released(),true);
});
test('invalid acknowledgement input never reaches the database', async () => {
  for (const ack of [['-1'],['1 OR 1=1'],['99999999999999999999999999'],Array(101).fill('1')]) {
    const db = fake();
    await assert.rejects(syncMobileAlerts(db.pool,'user',{deviceId,ack}),/Invalid/);
    assert.equal(db.queries.length,0);
  }
});
test('database errors roll back and release the connection', async () => {
  const db = fake(true);
  await assert.rejects(syncMobileAlerts(db.pool,'user',{deviceId,ack:[]}),/DB unavailable/);
  assert.equal(db.queries.at(-1)?.sql,'ROLLBACK');
  assert.equal(db.released(),true);
});

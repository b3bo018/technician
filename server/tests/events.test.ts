import test from 'node:test';
import assert from 'node:assert/strict';
import { afterDocumentWrite } from '../src/events.js';

function fakeDb() {
  const queued: any[] = [];
  const users = [{ id: 'admin-1' }, { id: 'manager-1' }, { id: 'hr-1' }, { id: 'tech-1' }];
  const client = { query: async (sql: string, params: any[] = []) => {
    if (sql.includes('SELECT data FROM documents')) return { rows: [{ data: { technician_name: 'Tech One', company_name: 'Example LLC', job_reference: 'ST01234' } }] };
    if (sql.includes("SELECT id FROM documents WHERE collection='users'")) return { rows: users.filter((user) => params[0].includes(user.id === 'hr-1' ? 'hr' : user.id === 'manager-1' ? 'manager' : user.id === 'tech-1' ? 'technician' : 'admin')) };
    if (sql.includes('INSERT INTO push_outbox')) { queued.push({ uid: params[0], key: params[1], title: params[2], body: params[3] }); return { rows: [{ id: queued.length }], rowCount: 1 } as any; }
    if (sql.includes("INSERT INTO documents(collection,id,data")) return { rows: [], rowCount: 1 } as any;
    throw new Error(`Unexpected SQL in test: ${sql}`);
  } };
  return { client, queued };
}

test('assignment notification goes only to the assigned technician', async () => {
  const { client, queued } = fakeDb();
  await afterDocumentWrite(client, 'shifts', 'job-1', { status: 'assigned', technician_id: 'tech-1', assigned_at: '2026-10-07T08:00:00Z' }, null, 'set');
  assert.deepEqual(queued.map((item) => item.uid), ['tech-1']);
  assert.equal(queued.some((item) => item.key.startsWith('job-assigned-office:')), false);
});

test('new site arrival notifies office recipients once, not the technician', async () => {
  const { client, queued } = fakeDb();
  const arrival = { technician_id: 'tech-1', timestamp: '2026-10-07T08:25:00Z' };
  await afterDocumentWrite(client, 'attendance_logs', 'job-1', arrival, null, 'set');
  await afterDocumentWrite(client, 'attendance_logs', 'job-1', arrival, arrival, 'update');
  assert.deepEqual(queued.map((item) => item.uid).sort(), ['admin-1', 'hr-1', 'manager-1']);
  assert.equal(queued.every((item) => item.title === 'Technician arrived'), true);
});

test('vehicle and whole-job completion notifications reach office roles', async () => {
  const { client, queued } = fakeDb();
  await afterDocumentWrite(client, 'installations', 'vehicle-1', { technician_name: 'Tech One', customer_ref: 'Example LLC', vehicle_ref: 'A123', shift_id: 'job-1', completed_at: '2026-10-07T09:00:00Z', progress_total: 1, progress_completed: 1 }, null, 'set');
  assert.equal(queued.some((item) => item.key.startsWith('vehicle-completed:') && item.uid === 'hr-1'), true);
  assert.equal(queued.some((item) => item.key.startsWith('full-job-completed:') && item.uid === 'manager-1'), true);
});

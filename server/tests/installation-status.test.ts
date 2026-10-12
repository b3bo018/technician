import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCompletedInstallationStatus, prepareCertificateWrite } from '../src/installation-status.ts';

const actor = { uid: 'tech-1', role: 'technician', status: 'active' };
function fakeDb(certificates: any[], shift: any = { status: 'in_progress' }) {
  const audits: any[] = [], histories: any[] = [];
  const client = { query: async (sql: string, params: any[] = []) => {
    if (sql.includes("collection=$1 and id=$2 for update")) return { rows: params[0] === 'shifts' ? [{ data: shift }] : [] };
    if (sql.includes("collection='certificates'") && sql.includes('id=$1')) return { rows: structuredClone(certificates.filter(row => row.id === params[0] || row.data.certificate_id === params[0] || row.data.vehicle_id === params[0])) };
    if (sql.includes("collection='certificates'")) return { rows: structuredClone(certificates) };
    if (sql.includes("collection=$1 and id=$2") && params[0] === 'users') return { rows: [{ data: { displayName: 'Tech One', email: 'tech@example.com' } }] };
    if (sql.startsWith('update documents set data=')) {
      const cert = certificates.find(row => row.id === params[1]);
      if (cert) cert.data = params[2];
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('insert into documents')) {
      (params[0] === 'audit_events' ? audits : histories).push(params[2]);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  return { client, audits, histories, certificates };
}
const cert = (id: string, data: any = {}) => ({ id, data: { status: 'Issued', installation_status: 'UNINSTALLED', vehicle_number: 'A 12345', chassis_number: 'CH-1', ...data }, version: 1 });
const completed = (id = 'job__unit_1', extra: any = {}) => ({ collection: 'installations', id, operation: 'set' as const, existing: null,
  next: { shift_id: 'job', job_type: 'new_installation', vehicle_ref: 'A 12345', unit_index: 0, unit_records: [{ vehicle_number: 'A 12345', job_type: 'new_installation' }],
    completed_at: '2026-10-12T08:00:00Z', completed_by_uid: actor.uid, completed_by_name: 'Tech One', ...extra } });

test('new manual certificate issuance defaults to Uninstalled but preserves drafts and historical imports', () => {
  assert.equal(prepareCertificateWrite({ status: 'Issued', source: 'SecureTrack System', installation_status: 'Installed' }, null).installation_status, 'Uninstalled');
  assert.equal(prepareCertificateWrite({ status: 'Draft', installation_status: 'Installed' }, null).installation_status, 'Installed');
  assert.equal(prepareCertificateWrite({ status: 'Issued', source: 'Historical Import', installation_status: 'Installed' }, null).installation_status, 'Installed');
});

test('scheduled and arrival-only changes do not update certificates', async () => {
  const db = fakeDb([cert('cert-1')]);
  await applyCompletedInstallationStatus(db.client, actor, [
    { collection: 'shifts', id: 'job', operation: 'update', existing: { status: 'assigned' }, next: { status: 'in_progress' } },
  ]);
  assert.equal(db.certificates[0].data.installation_status, 'UNINSTALLED');
});

test('successful relevant completion updates the database and creates status history and audit', async () => {
  const db = fakeDb([cert('cert-1')]);
  await applyCompletedInstallationStatus(db.client, actor, [completed()]);
  assert.equal(db.certificates[0].data.installation_status, 'Installed');
  assert.equal(db.certificates[0].data.installation_status_job_id, 'job');
  assert.equal(db.histories.length, 1);
  assert.equal(db.histories[0].previous_status, 'UNINSTALLED');
  assert.equal(db.histories[0].new_status, 'Installed');
  assert.equal(db.audits.length, 1);
  assert.equal(db.audits[0].changes.installation_status.old, 'UNINSTALLED');
  assert.equal(db.audits[0].changes.installation_status.new, 'INSTALLED');
  assert.equal(db.audits[0].job_id, 'job');
  assert.equal(db.audits[0].actor_uid, actor.uid);
});

test('cancelled, incomplete, removal, and payment jobs leave status unchanged', async () => {
  for (const mutation of [completed('cancelled-job', { shift_id: 'cancelled', job_type: 'new_installation' }),
    completed('pending', { completed_at: undefined }), completed('removal', { job_type: 'device_removal', unit_records: [{ vehicle_number: 'A 12345', job_type: 'device_removal' }] }),
    completed('payment', { job_type: 'payment_collection', unit_records: [{ vehicle_number: 'A 12345', job_type: 'payment_collection' }] })]) {
    const db = fakeDb([cert('cert-1')], mutation.next.shift_id === 'cancelled' ? { status: 'cancelled' } : { status: 'in_progress' });
    await applyCompletedInstallationStatus(db.client, actor, [mutation]);
    assert.equal(db.certificates[0].data.installation_status, 'UNINSTALLED');
    assert.equal(db.audits.length, 0);
  }
  const failed = fakeDb([cert('failed-cert')], { status: 'failed' });
  await applyCompletedInstallationStatus(failed.client, actor, [completed('failed-install')]);
  assert.equal(failed.certificates[0].data.installation_status, 'UNINSTALLED');
  assert.equal(failed.audits.length, 0);
});

test('already installed and ambiguous vehicle matches are safely ignored', async () => {
  const installed = fakeDb([cert('cert-1', { installation_status: 'Installed' })]);
  await applyCompletedInstallationStatus(installed.client, actor, [completed()]);
  assert.equal(installed.audits.length, 0);
  const ambiguous = fakeDb([cert('cert-1'), cert('cert-2')]);
  await applyCompletedInstallationStatus(ambiguous.client, actor, [completed()]);
  assert.equal(ambiguous.certificates.every(row => row.data.installation_status === 'UNINSTALLED'), true);
  assert.equal(ambiguous.audits.length, 0);
});

test('multi-vehicle completions update only the completed vehicle record', async () => {
  const second = cert('cert-2', { vehicle_number: 'B 22222', chassis_number: 'CH-2' });
  const db = fakeDb([cert('cert-1'), second]);
  await applyCompletedInstallationStatus(db.client, actor, [completed('job__unit_1'), completed('job__unit_2', {
    unit_index: 1, vehicle_ref: 'B 22222', unit_records: [{ vehicle_number: 'B 22222', job_type: 'inspection', inspection_action: 'check_only' }], job_type: 'inspection', inspection_action: 'check_only' })]);
  assert.deepEqual(db.certificates.map(row => row.data.installation_status), ['Installed', 'Installed']);
  assert.equal(db.audits.length, 2);
});

test('an explicit certificate ID takes priority over vehicle-number fallback', async () => {
  const db = fakeDb([cert('cert-1', { vehicle_number: 'DUPLICATE' }), cert('cert-2', { vehicle_number: 'DUPLICATE' })]);
  await applyCompletedInstallationStatus(db.client, actor, [completed('job__unit_1', { certificate_id: 'cert-2', vehicle_ref: 'DUPLICATE',
    unit_records: [{ vehicle_number: 'DUPLICATE', job_type: 'new_installation' }] })]);
  assert.deepEqual(db.certificates.map(row => row.data.installation_status), ['UNINSTALLED', 'Installed']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { canRead, canWrite, isTechnicianShiftUpdate, type Actor } from '../src/policy.js';

const technician: Actor = { uid: 'tech-1', role: 'technician', status: 'active' };
const admin: Actor = { uid: 'admin-1', role: 'admin', status: 'active' };

test('technicians can only read their own job records', () => {
  assert.equal(canRead(technician, 'shifts', 'job-1', { technician_id: technician.uid }), true);
  assert.equal(canRead(technician, 'shifts', 'job-2', { technician_id: 'tech-2' }), false);
  assert.equal(canRead(admin, 'shifts', 'job-2', { technician_id: 'tech-2' }), true);
});

test('technician arrival is limited to their assigned open job', () => {
  const before = { technician_id: technician.uid, status: 'assigned', is_deleted: false };
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'in_progress', arrived_at: '2026-10-06T08:00:00.000Z' }, before, 'update'), true);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'completed' }, before, 'update'), false);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, technician_id: 'tech-2', status: 'in_progress', arrived_at: '2026-10-06T08:00:00.000Z' }, before, 'update'), false);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'in_progress', arrived_at: '2026-10-06T08:00:00.000Z', company_name: 'changed' }, before, 'update'), false);
});

test('technician completion transitions require a valid increasing unit count', () => {
  const before = { technician_id: technician.uid, status: 'in_progress', is_deleted: false, unit_count: 3, completed_units: 1 };
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, completed_units: 2 }, before, 'update'), true);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'completed', completed_units: 2 }, before, 'update'), false);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'completed', completed_units: 3, completed_at: '2026-10-06T09:00:00.000Z' }, before, 'update'), true);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, completed_units: 2, technician_name: 'changed' }, before, 'update'), false);
  assert.equal(isTechnicianShiftUpdate(technician, 'job-1', { ...before, status: 'completed', completed_units: 3 }, { ...before, is_deleted: true }, 'update'), false);
});

test('technician completion notifications are limited to recognized admin notices', () => {
  const notification = { actor_uid: technician.uid, type: 'job_completed', recipient_roles: ['master_admin', 'admin', 'manager'] };
  assert.equal(canWrite(technician, 'operational_notifications', 'completion-1', notification, null, 'set'), true);
  assert.equal(canWrite(technician, 'operational_notifications', 'other-1', { ...notification, type: 'arbitrary' }, null, 'set'), false);
  assert.equal(canWrite(technician, 'operational_notifications', 'other-2', { ...notification, actor_uid: 'tech-2' }, null, 'set'), false);
  assert.equal(canWrite(technician, 'operational_notifications', 'other-3', { ...notification, recipient_roles: ['technician'] }, null, 'set'), false);
});

test('technician write scope remains limited to their own records', () => {
  assert.equal(canWrite(technician, 'attendance_logs', 'job-1', { technician_id: technician.uid }, null, 'set'), true);
  assert.equal(canWrite(technician, 'attendance_logs', 'job-1', { technician_id: 'tech-2' }, null, 'set'), false);
  assert.equal(canWrite(technician, 'shifts', 'job-1', { technician_id: technician.uid, status: 'assigned' }, { technician_id: technician.uid, status: 'assigned' }, 'update'), false);
});

test('manager verification can change only online status and cannot override a final result', () => {
  const manager: Actor = { uid: 'manager-1', role: 'manager', status: 'active' };
  const existing = { technician_id: technician.uid, online_status: 'not_checked', online_check_failures: 0, vehicle_ref: 'A123' };
  const notShowing = { ...existing, online_status: 'not_showing', online_check_failures: 1, online_status_updated_by_uid: manager.uid, online_status_updated_by: 'Manager', online_status_updated_at: '2026-10-06T09:00:00.000Z' };
  assert.equal(canWrite(manager, 'installations', 'installation-1', notShowing, existing, 'update'), true);
  assert.equal(canWrite(manager, 'installations', 'installation-1', { ...notShowing, vehicle_ref: 'changed' }, existing, 'update'), false);
  const final = { ...notShowing, online_status: 'showing_online', online_status_updated_by_uid: manager.uid };
  assert.equal(canWrite(manager, 'installations', 'installation-1', final, notShowing, 'update'), true);
  assert.equal(canWrite(manager, 'installations', 'installation-1', { ...final, online_status: 'not_showing', online_check_failures: 2 }, final, 'update'), false);
  assert.equal(canWrite(manager, 'job_online_status_history', 'event-1', { changed_by_uid: manager.uid }, null, 'set'), true);
});

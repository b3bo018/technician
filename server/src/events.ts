import { enqueueForRecipients, enqueuePush } from './push.js';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
const officeRoles = ['master_admin', 'owner', 'admin', 'manager', 'hr'];

export async function afterDocumentWrite(client: DbClient, collection: string, id: string, next: any, existing: any,
  operation: 'set' | 'update' | 'delete') {
  if (collection === 'operational_notifications' && operation === 'set' && !existing) {
    const type = String(next?.type || 'operations_update');
    const title = ({ job_completed: 'Job completed', vehicle_completed: 'Vehicle completed', job_assigned: 'Job assigned', certificate_issued: 'Certificate issued', certificate_updated: 'Certificate updated' } as Record<string, string>)[type] || type.replace(/_/g, ' ');
    await enqueueForRecipients(client as any, `operation:${id}`, { title, body: 'Open SecureTrack to view the update.', url: '/?section=jobs' }, next?.recipient_roles, next?.recipient_uids);
  }

  // An assignment is private to the technician who has to perform it.
  if (collection === 'shifts' && operation !== 'delete' && next?.status === 'assigned' && next?.technician_id
    && (!existing || existing.technician_id !== next.technician_id || existing.assigned_at !== next.assigned_at)) {
    const key = String(next.assigned_at || new Date().toISOString());
    await enqueuePush(client as any, String(next.technician_id), `job-assigned:${id}:${key}`, {
      title: existing ? 'Job reassigned' : 'New job assigned',
      body: 'A job assignment changed. Open SecureTrack to view the schedule.', url: '/?section=jobs',
    });
  }

  // Attendance is written once per job, so the notification is idempotent and fires on arrival only.
  if (collection === 'attendance_logs' && operation === 'set' && !existing && next?.technician_id) {
    const result = await client.query('SELECT data FROM documents WHERE collection=$1 AND id=$2', ['shifts', id]);
    const shift = result.rows[0]?.data || {};
    const technician = String(shift.technician_name || 'A technician');
    const company = String(shift.company_name || shift.customer_name || shift.site_name || 'assigned site');
    const reference = String(shift.job_reference || id);
    await enqueueForRecipients(client as any, `job-arrived:${id}:${String(next.timestamp || '')}`, {
      title: 'Technician arrived', body: `${technician} arrived at ${company} · Job ${reference}.`, url: '/?section=jobs',
    }, officeRoles, []);
  }

  if (collection === 'installations' && operation !== 'delete' && next?.completed_at
    && (!existing || existing.completed_at !== next.completed_at)) {
    const technician = String(next.technician_name || 'A technician');
    const company = String(next.customer_ref || 'Company');
    const vehicle = String(next.vehicle_ref || 'Vehicle');
    await enqueueForRecipients(client as any, `vehicle-completed:${id}:${String(next.completed_at)}`, {
      title: 'Vehicle completed', body: `${technician} completed ${vehicle} for ${company}. Open SecureTrack to review the work record.`, url: '/?section=jobs',
    }, officeRoles, []);
    const total = Number(next.progress_total || 0), completed = Number(next.progress_completed || 0);
    if (next.shift_id && total > 0 && completed >= total) {
      await enqueueForRecipients(client as any, `full-job-completed:${next.shift_id}:${String(next.completed_at)}`, {
        title: 'Company job completed', body: `${technician} completed all ${total} vehicles for ${company}.`, url: '/?section=jobs',
      }, officeRoles, []);
    }
  }

  if (collection === 'certificates' && ((operation === 'delete' && existing) || next)) {
    const deleted = operation === 'delete' || !!next?.is_deleted, isNew = !existing || existing.is_deleted;
    await enqueueForRecipients(client as any, `certificate:${id}:${deleted ? 'deleted' : String(next.updated_at || next.issue_date || new Date().toISOString())}`, {
      title: deleted ? 'Certificate deleted' : isNew ? 'Certificate issued' : 'Certificate updated',
      body: 'A certificate record changed. Open SecureTrack to review it.', url: '/?section=certificates',
    }, ['master_admin', 'owner', 'admin', 'manager', 'accountant'], []);
  }

  if (collection === 'inventory_logs' && operation === 'set' && next?.type === 'received' && next?.technician_id) {
    await enqueuePush(client as any, String(next.technician_id), `inventory-received:${id}`, {
      title: 'Inventory received', body: 'Stock was added to your SecureTrack inventory.', url: '/?section=inventory',
    });
  }
}

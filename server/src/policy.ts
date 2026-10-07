export type Actor = { uid: string; role: string; status: string };

const staff = new Set(['master_admin', 'owner', 'admin', 'manager', 'accountant', 'hr', 'it']);
const agreementStaff = new Set(['master_admin', 'owner', 'admin', 'accountant', 'hr']);
const certificateStaff = new Set(['master_admin', 'owner', 'admin', 'manager', 'accountant']);
const stockAdmin = new Set(['master_admin', 'admin', 'accountant']);
const assigner = new Set(['master_admin', 'admin']);

const own = (actor: Actor, data: any) =>
  [data?.technician_id, data?.tech_id, data?.uid, data?.actor_uid, data?.changed_by_uid].includes(actor.uid);

export const isStaff = (actor: Actor) => staff.has(actor.role) && actor.status !== 'deactivated';

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canVerifyInstallation(actor: Actor, next: any, existing: any, op: 'set' | 'update' | 'delete') {
  if (op !== 'update' || !['master_admin', 'admin', 'manager', 'hr'].includes(actor.role) || !existing) return false;
  const fields = new Set(['online_status', 'online_check_failures', 'online_status_updated_at', 'online_status_updated_by', 'online_status_updated_by_uid']);
  const changed = [...new Set([...Object.keys(existing), ...Object.keys(next || {})])]
    .filter(key => !sameValue(existing[key], next?.[key]));
  if (!changed.length || changed.some(key => !fields.has(key)) || next?.online_status_updated_by_uid !== actor.uid) return false;
  const previous = existing.online_status || 'not_checked';
  const status = next.online_status;
  if (!['not_showing', 'showing_online'].includes(status) || previous === 'showing_online') return false;
  const expectedFailures = Number(existing.online_check_failures || 0) + (status === 'not_showing' ? 1 : 0);
  return Number(next.online_check_failures || 0) === expectedFailures;
}

/** A technician may only confirm their own arrival or save a completion transition. */
export function isTechnicianShiftUpdate(actor: Actor, id: string, next: any, existing: any, op: 'set' | 'update' | 'delete') {
  if (actor.role !== 'technician' || op !== 'update' || id.length === 0) return false;
  if (existing?.technician_id !== actor.uid || next?.technician_id !== actor.uid || existing?.is_deleted) return false;

  const changed = new Set([
    ...Object.keys(existing || {}),
    ...Object.keys(next || {}),
  ].filter(key => !sameValue(existing?.[key], next?.[key])));

  if (existing.status === 'assigned' && next.status === 'in_progress') {
    return next.arrived_at != null && [...changed].every(key => key === 'status' || key === 'arrived_at');
  }

  if (existing.status !== 'in_progress' || !['in_progress', 'completed'].includes(next.status)) return false;
  const completionFields = new Set([
    'status', 'completed_units', 'last_vehicle_completed_at', 'completed_at',
    'completion_latitude', 'completion_longitude', 'completion_accuracy_m',
  ]);
  if (![...changed].every(key => completionFields.has(key))) return false;
  const completed = Number(next.completed_units ?? (next.status === 'completed' ? 1 : 0));
  const total = Math.max(1, Number(existing.unit_count || 1));
  return Number.isInteger(completed) && completed >= 1 && completed <= total
    && (next.status !== 'completed' || completed >= total)
    && (next.status !== 'in_progress' || completed < total);
}

export function canRead(actor: Actor, collection: string, id: string, data: any) {
  if (actor.status === 'deactivated') return false;
  switch (collection) {
    case 'users': return id === actor.uid || isStaff(actor);
    case 'inventory_accounts': case 'technician_live_stock': case 'inventory_logs': case 'installations':
    case 'shifts': case 'login_logs': case 'attendance_logs': case 'work_sessions': case 'work_breaks':
      return own(actor, data) || isStaff(actor);
    case 'company_inventory': case 'company_inventory_history': case 'assignment_index':
    case 'job_online_status_history': case 'job_schedule_history': case 'device_models':
      return isStaff(actor);
    case 'operational_notifications': {
      const uids = Array.isArray(data?.recipient_uids) ? data.recipient_uids.map(String) : [];
      const roles = Array.isArray(data?.recipient_roles) ? data.recipient_roles.map(String) : [];
      return uids.includes(actor.uid) || roles.includes(actor.role)
        || (isStaff(actor) && uids.length === 0 && roles.length === 0);
    }
    case 'agreement_settings': case 'agreement_packages': case 'agreements': case 'agreement_links':
      return agreementStaff.has(actor.role);
    case 'certificates': case 'certificate_status_history': case 'certificate_payment_history':
    case 'certificate_edit_history': case 'certificate_settings': case 'renewals':
      return certificateStaff.has(actor.role);
    case 'audit_events': return actor.role === 'master_admin';
    case 'error_logs': return ['master_admin', 'admin'].includes(actor.role);
    case 'settings': return true;
    case 'counters': return ['master_admin', 'admin', 'manager'].includes(actor.role);
    default: return isStaff(actor);
  }
}

export function canWrite(actor: Actor, collection: string, id: string, next: any, existing: any, op: 'set' | 'update' | 'delete') {
  if (actor.status === 'deactivated') return false;
  if (collection === 'users') {
    if (op === 'delete') return actor.uid !== id && (actor.role === 'master_admin' || (actor.role === 'admin' && !['master_admin', 'owner'].includes(existing?.role)));
    if (id === actor.uid) return op === 'update';
    return assigner.has(actor.role) || actor.role === 'master_admin';
  }
  if (['inventory_accounts', 'technician_live_stock', 'inventory_logs'].includes(collection)) return own(actor, next || existing) || stockAdmin.has(actor.role);
  if (['company_inventory', 'company_inventory_history'].includes(collection)) return stockAdmin.has(actor.role);
  if (collection === 'shifts') return assigner.has(actor.role) || isTechnicianShiftUpdate(actor, id, next, existing, op);
  if (['schedule_locks', 'job_schedule_history'].includes(collection)) return assigner.has(actor.role);
  if (collection === 'installations') return own(actor, next || existing) || assigner.has(actor.role) || canVerifyInstallation(actor, next, existing, op);
  if (collection === 'assignment_index') return own(actor, next || existing) || assigner.has(actor.role);
  if (['login_logs', 'attendance_logs', 'work_sessions', 'work_breaks'].includes(collection)) return own(actor, next || existing) || actor.role === 'master_admin' || actor.role === 'hr';
  if (['agreement_settings', 'agreement_packages'].includes(collection)) return ['master_admin', 'admin'].includes(actor.role);
  if (collection === 'agreements' || collection === 'agreement_links') return ['master_admin', 'admin', 'hr'].includes(actor.role);
  if (['certificates', 'certificate_status_history', 'certificate_payment_history', 'certificate_edit_history', 'renewals'].includes(collection)) return ['master_admin', 'admin', 'manager', 'accountant'].includes(actor.role);
  if (collection === 'certificate_settings' || collection === 'device_models') return ['master_admin', 'admin'].includes(actor.role);
  if (collection === 'audit_events') return next?.actor_uid === actor.uid;
  if (collection === 'job_online_status_history') return ['master_admin', 'admin', 'manager', 'hr'].includes(actor.role) && op === 'set' && next?.changed_by_uid === actor.uid;
  if (collection === 'operational_notifications') {
    if (isStaff(actor)) return op === 'update' || next?.actor_uid === actor.uid;
    return actor.role === 'technician' && op === 'set' && next?.actor_uid === actor.uid
      && ['job_completed', 'vehicle_completed'].includes(next?.type)
      && Array.isArray(next?.recipient_roles) && next.recipient_roles.every((role: unknown) => ['master_admin', 'owner', 'admin', 'manager'].includes(String(role)));
  }
  if (collection === 'error_logs') return op === 'set' && next?.user_uid === actor.uid;
  if (collection === 'settings') return stockAdmin.has(actor.role) || actor.role === 'hr';
  if (collection === 'counters') return ['master_admin', 'admin', 'manager'].includes(actor.role);
  return actor.role === 'master_admin';
}

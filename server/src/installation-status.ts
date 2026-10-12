import { randomUUID } from 'node:crypto';

type DbClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };
type Actor = { uid: string; role: string; status: string };
type Mutation = { collection: string; id: string; next: any; existing: any; operation: 'set' | 'update' | 'delete' };

const normalizeKey = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizedStatus = (value: unknown) => {
  const status = String(value ?? '').trim().toLowerCase().replace(/[ _-]+/g, ' ');
  if (status === 'installed') return 'Installed';
  if (['uninstalled', 'not installed', 'unistalled'].includes(status)) return 'Uninstalled';
  return '';
};

/** New manually-issued certificates must begin uninstalled. Drafts and imported history keep their supplied values. */
export function prepareCertificateWrite(data: any, existing: any) {
  if (!existing && data?.status === 'Issued' && data?.source !== 'Historical Import') {
    return { ...data, installation_status: 'Uninstalled' };
  }
  return data;
}

function hasInstalledWork(record: any) {
  const unit = Array.isArray(record?.unit_records) ? record.unit_records[0] : null;
  const type = String(unit?.job_type || record?.job_type || '').toLowerCase();
  if (['new_installation', 'device_change', 'sim_change', 'sim_device_change'].includes(type)) return true;
  // An inspection is completed per vehicle; its completed inspection result is positive work.
  return type === 'inspection' && ['check_only', 'device_change', 'sim_change', 'sim_device_change'].includes(String(unit?.inspection_action || record?.inspection_action || ''));
}

function identifiers(...records: any[]) {
  const names = ['certificate_id', 'certificateId', 'vehicle_id', 'vehicleId'];
  for (const record of records) {
    for (const name of names) {
      const value = record?.[name];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return '';
}

function matchCertificate(rows: any[], internalId: string, vehicle: string, chassis: string) {
  const active = rows.filter(row => row.data?.status === 'Issued' && !row.data?.is_deleted);
  if (internalId) {
    const matches = active.filter(row => row.id === internalId
      || row.data?.certificate_id === internalId || row.data?.vehicle_id === internalId);
    return matches.length === 1 ? matches[0] : null;
  }
  const vehicleKey = normalizeKey(vehicle), chassisKey = normalizeKey(chassis);
  if (!vehicleKey && !chassisKey) return null;
  const matches = active.filter(row => {
    const rowVehicle = normalizeKey(row.data?.vehicle_number), rowChassis = normalizeKey(row.data?.chassis_number);
    return vehicleKey && chassisKey ? rowVehicle === vehicleKey && rowChassis === chassisKey
      : vehicleKey ? rowVehicle === vehicleKey : rowChassis === chassisKey;
  });
  return matches.length === 1 ? matches[0] : null;
}

/** Persist status and history in the same PostgreSQL transaction as the successful job completion. */
export async function applyCompletedInstallationStatus(client: DbClient, actor: Actor, mutations: Mutation[]) {
  const completions = mutations.filter(m => m.collection === 'installations' && m.operation !== 'delete'
    && m.next?.completed_at && (!m.existing?.completed_at || m.existing.completed_at !== m.next.completed_at)
    && hasInstalledWork(m.next));
  for (const mutation of completions) {
    const jobId = String(mutation.next.shift_id || '');
    let shift: any = null;
    try {
      const jobResult = jobId ? await client.query('select data from documents where collection=$1 and id=$2 for update', ['shifts', jobId]) : { rows: [] };
      shift = jobResult.rows[0]?.data || null;
    } catch (error) {
      console.error('Certificate installation status update failed', { jobId, installationId: mutation.id, error });
      throw error;
    }
    if (!shift || !['completed', 'in_progress'].includes(String(shift.status || '')) || shift.is_deleted) continue;

    const unit = Array.isArray(mutation.next.unit_records) ? mutation.next.unit_records[0] : null;
    const unitIndex = Number(mutation.next.unit_index);
    const assignedUnit = Number.isInteger(unitIndex) && unitIndex >= 0
      ? shift?.unit_jobs?.[unitIndex] || null : null;
    const linkedId = identifiers(mutation.next, unit, assignedUnit, shift);
    const vehicle = String(unit?.vehicle_number || mutation.next.vehicle_ref || assignedUnit?.vehicle_number || shift?.vehicle_numbers?.[unitIndex] || shift?.vehicle_number || '');
    const chassis = String(unit?.chassis_number || mutation.next.chassis_number || assignedUnit?.chassis_number || '');
    let certRows: any[] = [];
    try {
      if (linkedId) {
        const result = await client.query("select id,data,version from documents where collection='certificates' and (id=$1 or data->>'certificate_id'=$1 or data->>'vehicle_id'=$1) for update", [linkedId]);
        certRows = result.rows;
      } else {
        // Lock matching active records. Ambiguous matches are intentionally left unchanged.
        const vehicleKey = normalizeKey(vehicle), chassisKey = normalizeKey(chassis);
        if (!vehicleKey && !chassisKey) continue;
        const clauses = ["collection='certificates'", "data->>'status'='Issued'", "coalesce(data->>'is_deleted','false')<>'true'"];
        const params: string[] = [];
        const normVehicle = "upper(regexp_replace(coalesce(data->>'vehicle_number',''), '[^A-Za-z0-9]', '', 'g'))";
        const normChassis = "upper(regexp_replace(coalesce(data->>'chassis_number',''), '[^A-Za-z0-9]', '', 'g'))";
        if (vehicleKey) { params.push(vehicleKey); clauses.push(`${normVehicle}=$${params.length}`); }
        if (chassisKey) { params.push(chassisKey); clauses.push(`${normChassis}=$${params.length}`); }
        const result = await client.query(`select id,data,version from documents where ${clauses.join(' and ')} for update`, params);
        certRows = result.rows;
      }
      const certificate = matchCertificate(certRows, linkedId, vehicle, chassis);
      if (!certificate) continue;
      const oldStatus = normalizedStatus(certificate.data?.installation_status);
      if (oldStatus !== 'Uninstalled') continue;
      const oldRawStatus = String(certificate.data?.installation_status ?? '');

      const timestamp = new Date().toISOString();
      const actorResult = await client.query('select data from documents where collection=$1 and id=$2', ['users', actor.uid]);
      const profile = actorResult.rows[0]?.data || {};
      const actorName = String(profile.displayName || profile.display_name || profile.name || profile.email || actor.uid);
      const next = { ...certificate.data, installation_status: 'Installed', installation_status_updated_at: timestamp,
        installation_status_updated_by: actorName,
        installation_status_updated_by_uid: actor.uid,
        installation_status_job_id: jobId, installation_status_job_record_id: mutation.id };
      await client.query('update documents set data=$3,version=version+1,updated_at=now() where collection=$1 and id=$2', ['certificates', certificate.id, next]);

      const details = { company: String(certificate.data?.company_name || ''), vehicle: String(certificate.data?.vehicle_number || vehicle),
        chassis: String(certificate.data?.chassis_number || chassis), certificate_number: String(certificate.data?.tracker_id || ''),
        job_id: jobId, reason: 'Installation/inspection job completed',
        changes: { installation_status: { old: 'UNINSTALLED', new: 'INSTALLED' } } };
      await client.query('insert into documents(collection,id,data,version,created_at,updated_at) values($1,$2,$3,1,now(),now())',
        ['certificate_status_history', randomUUID(), { certificate_id: certificate.id, tracker_id: details.certificate_number,
          previous_status: oldRawStatus, new_status: 'Installed', changed_by: actorName,
          changed_by_uid: actor.uid, changed_at: timestamp, job_id: jobId, reason: details.reason }]);
      const searchable = [actor.uid, actorName, actor.role, 'Certificates', 'INSTALLATION_STATUS_UPDATED', certificate.id, details.company, details.vehicle, details.chassis, jobId, details.certificate_number]
        .map(value => String(value || '').trim().toLowerCase()).filter(Boolean).flatMap(value => [value, ...value.split(/\s+/).filter(part => part.length > 1)]);
      await client.query('insert into documents(collection,id,data,version,created_at,updated_at) values($1,$2,$3,1,now(),now())',
        ['audit_events', randomUUID(), { actor_uid: actor.uid, actor_name: actorName, actor_email: String(profile.email || ''), actor_role: actor.role,
          action: 'INSTALLATION_STATUS_UPDATED', module: 'Certificates', record_id: certificate.id, company: details.company, vehicle: details.vehicle,
          chassis: details.chassis, imei: '', sim: '', job_id: jobId, certificate_number: details.certificate_number, reason: details.reason,
          changes: details.changes, deleted_record: false, search_tokens: [...new Set(searchable)].slice(0, 80), created_at: timestamp }]);
    } catch (error) {
      console.error('Certificate installation status update failed', { jobId, installationId: mutation.id, certificateId: linkedId || undefined, error });
      throw error;
    }
  }
}

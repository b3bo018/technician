import type { Pool } from 'pg';

/** Every query is scoped to the authenticated account, never a client-supplied user ID. */
export async function syncMobileAlerts(pool: Pool, uid: string, input: any) {
  const deviceId = input?.deviceId;
  const ack = input?.ack ?? [];
  if (typeof deviceId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(deviceId)
    || !Array.isArray(ack) || ack.length > 100 || ack.some(id => typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id)>9223372036854775807n)) {
    throw Object.assign(new Error('Invalid notification device or receipt.'), { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO mobile_alert_devices(user_id,device_id) VALUES($1,$2)
      ON CONFLICT(user_id,device_id) DO UPDATE SET last_seen_at=now()`, [uid, deviceId]);
    if (ack.length) await client.query(`INSERT INTO mobile_alert_receipts(user_id,device_id,event_id)
      SELECT $1,$2,id FROM push_outbox WHERE user_id=$1 AND id=ANY($3::bigint[])
      ON CONFLICT DO NOTHING`, [uid, deviceId, ack]);
    const result = await client.query(`SELECT p.id::text AS id,p.title,p.body,p.target_url AS url
      FROM push_outbox p JOIN mobile_alert_devices d ON d.user_id=p.user_id AND d.device_id=$2
      WHERE p.user_id=$1 AND p.created_at>=d.started_at
      AND NOT EXISTS (SELECT 1 FROM mobile_alert_receipts r
        WHERE r.user_id=$1 AND r.device_id=$2 AND r.event_id=p.id)
      ORDER BY p.id LIMIT 100`, [uid, deviceId]);
    await client.query('COMMIT');
    return { notifications: result.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

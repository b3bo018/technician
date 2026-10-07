import { createHash } from 'node:crypto';
import webpush, { type PushSubscription } from 'web-push';
import type { Pool, PoolClient } from 'pg';

export type PushActor = { uid: string; role: string; status: string };
export type PushNotification = { title: string; body: string; url?: string };

const vapidPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT || 'https://connect.securetrackgo.com';
const ownPushHosts = (process.env.PUSH_ALLOWED_HOSTS || 'push.securetrackgo.com,connect.securetrackgo.com')
  .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
const browserPushHosts = [
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'wns2-par02p.notify.windows.com',
];

if (vapidPublicKey && vapidPrivateKey) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export function pushReady() { return Boolean(vapidPublicKey && vapidPrivateKey); }
export function getVapidPublicKey() { return vapidPublicKey; }

export function allowedPushEndpoint(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    const host = url.hostname.toLowerCase();
    return ownPushHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
      || browserPushHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch { return false; }
}

export function pushEndpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex');
}

export async function registerPushSubscription(pool: Pool, uid: string, input: any) {
  const subscription = input?.subscription;
  const endpoint = String(subscription?.endpoint || '');
  const p256dh = String(subscription?.keys?.p256dh || '');
  const auth = String(subscription?.keys?.auth || '');
  const transport = input?.transport === 'unifiedpush' ? 'unifiedpush' : 'web';
  if (!allowedPushEndpoint(endpoint) || p256dh.length > 200 || auth.length > 200 || !p256dh || !auth) {
    throw Object.assign(new Error('Invalid push subscription.'), { status: 400 });
  }
  await pool.query(
    `INSERT INTO push_subscriptions(user_id, endpoint_hash, endpoint, p256dh, auth_secret, transport)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(user_id,endpoint_hash) DO UPDATE SET endpoint=excluded.endpoint,p256dh=excluded.p256dh,
       auth_secret=excluded.auth_secret,transport=excluded.transport,updated_at=now()`,
    [uid, pushEndpointHash(endpoint), endpoint, p256dh, auth, transport],
  );
}

export async function removePushSubscription(pool: Pool, uid: string, endpoint: unknown) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return;
  await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2', [uid, pushEndpointHash(endpoint)]);
}

export async function enqueuePush(client: Pool | PoolClient, userId: string, eventKey: string, notification: PushNotification) {
  const title = notification.title.trim().slice(0, 120);
  const body = notification.body.trim().slice(0, 500);
  const url = notification.url?.startsWith('/') && !notification.url.startsWith('//') ? notification.url.slice(0, 300) : '/';
  if (!userId || !eventKey || !title || !body) return;
  const queued = await client.query(
    `INSERT INTO push_outbox(user_id,event_key,title,body,target_url) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id`,
    [userId, eventKey.slice(0, 240), title, body, url],
  );
  if (!queued.rowCount || eventKey.startsWith('operation:')) return;

  const type = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'operations_update';
  const targetSection = (() => { try { return new URL(url, 'https://connect.securetrackgo.com').searchParams.get('section') || ''; } catch { return ''; } })();
  const id = `push_${createHash('sha256').update(`${userId}:${eventKey}`).digest('hex')}`;
  const data = {
    type, message: body, created_at: new Date().toISOString(), read_by: [],
    recipient_roles: [], recipient_uids: [userId], target_section: targetSection,
  };
  await client.query(
    `INSERT INTO documents(collection,id,data,version,created_at,updated_at)
     VALUES('operational_notifications',$1,$2,1,now(),now()) ON CONFLICT(collection,id) DO NOTHING`,
    [id, data],
  );
}

export async function enqueueForRecipients(client: Pool | PoolClient, eventKey: string, notification: PushNotification,
  recipientRoles: unknown, recipientUids: unknown) {
  const roles = Array.isArray(recipientRoles) ? recipientRoles.map(String).filter((r) => /^[a-z_]{2,40}$/.test(r)) : [];
  const uids = Array.isArray(recipientUids) ? recipientUids.map(String).filter((id) => id && id.length <= 128) : [];
  const recipients = new Set(uids);
  if (roles.length) {
    const rows = await client.query("SELECT id FROM documents WHERE collection='users' AND data->>'role'=ANY($1::text[]) AND COALESCE(data->>'status','active') <> 'deactivated'", [roles]);
    rows.rows.forEach((row) => recipients.add(String(row.id)));
  }
  for (const uid of recipients) await enqueuePush(client, uid, eventKey, notification);
}

async function deliverOne(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT id,user_id,event_key,title,body,target_url,attempts FROM push_outbox
       WHERE sent_at IS NULL AND available_at <= now() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
    );
    const job = selected.rows[0];
    if (!job) { await client.query('COMMIT'); return false; }
    const rows = await client.query('SELECT endpoint,p256dh,auth_secret FROM push_subscriptions WHERE user_id=$1', [job.user_id]);
    if (!rows.rows.length) {
      await client.query('UPDATE push_outbox SET sent_at=now() WHERE id=$1', [job.id]);
      await client.query('COMMIT'); return true;
    }
    await client.query('COMMIT');
    const payload = JSON.stringify({ title: job.title, body: job.body, url: job.target_url, id: job.event_key });
    const results = await Promise.allSettled(rows.rows.map(async (row) => {
      const subscription: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } };
      try { await webpush.sendNotification(subscription, payload, { TTL: 86400, urgency: 'high' }); return true; }
      catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint_hash=$2', [job.user_id, pushEndpointHash(row.endpoint)]);
        }
        throw error;
      }
    }));
    const delivered = results.every((result) => result.status === 'fulfilled');
    if (delivered) await pool.query('UPDATE push_outbox SET sent_at=now() WHERE id=$1', [job.id]);
    else {
      const attempts = Number(job.attempts || 0) + 1;
      const delayMinutes = Math.min(60, Math.max(1, 2 ** Math.min(attempts, 6)));
      await pool.query("UPDATE push_outbox SET attempts=$2,available_at=now()+($3::text || ' minutes')::interval WHERE id=$1", [job.id, attempts, delayMinutes]);
    }
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export function startPushWorker(pool: Pool) {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy || !pushReady()) return;
    busy = true;
    try { for (let count = 0; count < 25 && await deliverOne(pool); count += 1) { /* drain a small batch */ } }
    catch (error) { console.error('Push delivery worker failed', error); }
    finally { busy = false; }
  }, 1500);
  timer.unref();
}

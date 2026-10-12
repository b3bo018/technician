-- Run after 002_push_notifications.sql, before deploying the mobile-alert API.
CREATE TABLE IF NOT EXISTS mobile_alert_devices (
  user_id text NOT NULL,
  device_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,device_id)
);
CREATE TABLE IF NOT EXISTS mobile_alert_receipts (
  user_id text NOT NULL,
  device_id text NOT NULL,
  event_id bigint NOT NULL REFERENCES push_outbox(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,device_id,event_id),
  FOREIGN KEY(user_id,device_id) REFERENCES mobile_alert_devices(user_id,device_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS push_outbox_user_event_idx ON push_outbox(user_id,id);
GRANT SELECT,INSERT,UPDATE,DELETE ON mobile_alert_devices,mobile_alert_receipts TO securetrack;

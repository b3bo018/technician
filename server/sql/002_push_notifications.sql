-- AWS-hosted push registrations and a durable delivery queue.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id text NOT NULL,
  endpoint_hash text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  transport text NOT NULL CHECK (transport IN ('web', 'unifiedpush')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, endpoint_hash)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS push_outbox (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  event_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_url text NOT NULL DEFAULT '/',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS push_outbox_pending_idx ON push_outbox(available_at, id) WHERE sent_at IS NULL;

-- The API connects as the dedicated `securetrack` database role. Keep its
-- access limited to the push queue and subscription tables it must operate.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE push_outbox, push_subscriptions TO securetrack;
GRANT USAGE, SELECT ON SEQUENCE push_outbox_id_seq TO securetrack;

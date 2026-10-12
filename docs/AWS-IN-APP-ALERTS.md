# AWS alerts inside X OPS

Android code 22 / version 1.5.1 removes the UnifiedPush distributor requirement. No Firebase SDK, Google services file or companion app is used. This is a proposed update; do not deploy to Play before integration tests pass.

## Deploy the server first

1. Back up the production database and deploy from the AWS migration branch, not `main`.
2. Run `server/sql/003_mobile_alerts.sql` with the migration database role, after existing migration 002.
3. Deploy the Node server including `src/mobileAlerts.ts` and the authenticated `POST /v1/notifications/device-sync` route. Use existing Cognito, database and environment configuration. No new messaging credentials are needed.
4. Confirm anonymous requests return 401 and a deactivated account cannot sync. An active user must only receive their own queue events, regardless of a supplied `uid` field.

The queue is independent of browser push delivery. Receipts are scoped to user and installation, so one phone or another notification transport cannot consume another phone's events. The first enable establishes a baseline; later reconnects replay unacknowledged events created after that baseline. Keep queue records until the required recovery/retention period; purging them removes recovery capability.

## Android delivery

Enable App notifications inside X OPS Settings. Android notification permission is required. A low-priority persistent connection notification includes a Stop alerts action. The service checks the authenticated AWS queue every 15 seconds while connected, drains full batches promptly, and backs off up to two minutes on network failures. Cognito refresh tokens are stored encrypted using Android Keystore; sign-out/disable clears native credentials and stops delivery. The API origin is fixed to connect.securetrackgo.com, and HTTP redirects are refused.

Alert taps open X OPS. Section-specific deep linking is not implemented. First-time opt-in does not replay all historical notifications. Network delivery and process lifetime cannot be guaranteed. Do not call this instant push.

The service uses the dataSync foreground-service type. Android 15+ limits background dataSync runtime to six hours per 24 hours; its timeout stops the service cleanly. Reopening Settings resumes a previously requested connection where the OS permits. Stop alerts prevents automatic Settings reconnect until the user turns notifications on again. Force-stop, reboot, OS restrictions, network loss and manufacturer battery policies can interrupt alerts. No boot receiver or restriction bypass is included.

## Verify before signing and publishing

1. Install the debug build on a physical phone and sign in with a test account.
2. Enable alerts; verify the persistent notification and no distributor prompt.
3. Create an authorized test job/alert for that account. Confirm delivery while open and with screen locked. Do not use real customer data for test events.
4. Go offline, queue more alerts, reconnect, and verify replay without losing or repeatedly alerting the same event.
5. Confirm another user/phone cannot read or acknowledge this account's events.
6. Sign out, switch users and use Stop alerts; confirm the previous account produces no new system alerts.
7. Test expired tokens, permission denial/revocation, foreground-service timeout and reopening Settings.
8. Capture Play Console's required foreground-service evidence/declaration for data synchronization before submitting the signed release.

GitHub Actions builds the frontend and an unsigned-for-production debug APK. Upload keys remain local. The local Windows environment currently blocks esbuild child processes, so do not copy stale code21 web assets into a code22 release. Use successfully built cloud web assets, sync Android and sign locally with the existing upload key.

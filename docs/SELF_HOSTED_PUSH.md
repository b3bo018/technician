# Self-hosted SecureTrack push

SecureTrack stores authentication, notification rules, notification history, push registrations, and the delivery queue on AWS. The Node API sends Web Push directly from AWS. Android uses the open UnifiedPush protocol with an ntfy distributor configured to the AWS-hosted server. Firebase SDKs, Firestore, FCM, and hosted push vendors are not used.

## AWS setup

1. Point `push.securetrackgo.com` to the existing SecureTrack EC2 address `13.60.95.212`. Keep the existing `connect` record intact. After DNS resolves, obtain TLS for the new hostname with the host's existing Certbot/Nginx setup.
2. Install ntfy on the same EC2 instance, install `infra/ntfy/server.yml` as `/etc/ntfy/server.yml`, create `/var/lib/ntfy` and `/var/cache/ntfy` owned by the ntfy service account, then enable its systemd service. Do not configure `firebase-key-file` or any upstream hosted push proxy.
3. Install `infra/nginx/push.securetrackgo.com.conf` in Nginx, test the configuration, reload Nginx, then run Certbot for `push.securetrackgo.com`. Confirm `https://push.securetrackgo.com/v1/health` returns `{"healthy":true}`.
4. Apply `server/sql/002_push_notifications.sql` to the production PostgreSQL database before enabling push in the API.
5. Generate VAPID keys on the EC2 host with the installed server package (`node -e "console.log(require('web-push').generateVAPIDKeys())"`) and store the public key, private key, and HTTPS subject URL (`https://connect.securetrackgo.com`) in the API service's protected environment file. Push notifications are delivered only through the app's in-app notification center and self-hosted push transport; this configuration does not send email. Set `PUSH_ALLOWED_HOSTS=push.securetrackgo.com,connect.securetrackgo.com`. Keep the private key out of Git and client bundles. Restart the API only after the migration and environment values are present.
6. Publish the updated web bundle and API to the existing AWS instance. Verify `/v1/push/config`, `/health`, API preflight, job assignment/completion events, and delivery worker logs.

## Technician setup

On Android, install the ntfy app from F-Droid or another trusted source, set its server to `https://push.securetrackgo.com`, and allow its background operation/notification permission. Then open SecureTrack, sign in, and enable notifications under Settings. The app will ask Android to select ntfy as the UnifiedPush distributor. A persistent connection is used because FCM is excluded; allow the distributor to run in the background to avoid delayed delivery.

On the web, sign in on each browser and enable notifications in Settings. Each browser stores its own subscription and must grant OS notification permission.

Push messages carry generic alert text and a link. Operational details remain behind SecureTrack sign-in. Expired push endpoints are automatically removed; retry and deduplication state is stored in AWS PostgreSQL.

# SecureTrack maintenance and recovery

## Architecture

- React and TypeScript frontend built by Vite.
- Firebase Authentication for staff sign-in.
- Cloud Firestore for operational and historical data.
- Firebase Hosting for the web application.
- Capacitor Android shell for camera, location, notifications, sharing, and file access.
- Client-side PDF and Excel generation; WhatsApp opens a prepared `wa.me` message.

The application has no separate custom backend server in this checkout. Firestore security rules are the server-side authorization boundary.

## Logs and status

Signed-in frontend crashes and unhandled errors are written to the protected `error_logs` collection. Passwords, tokens, credential fields, cookies, authorization values, and API-key fields are removed from logged context. Admin and master-admin users can run live application, authentication, and Firestore checks from Settings → System status.

Business audit events are append-only in `audit_events`. Events store actor identity, role, action, module, record reference, searchable business identifiers, reason and changed fields only. They do not duplicate PDFs, photos, signatures, workbooks, or full database records. Abdulla's `master_admin` role is the only role with complete audit visibility.

## Backup status

Verified in Google Cloud Console on 28 September 2026: scheduled Firestore backups and point-in-time recovery are disabled for project `securetrack-technician-b3bo018`. The console prevents enabling them because billing is not enabled. Firebase Hosting release history protects deployed web builds but does not back up Firestore data.

**Owner action:** Enable billing for the Google Cloud project, then enable a daily Firestore backup schedule with multiple retained recovery points. If scheduled backups are unsuitable, arrange a scheduled managed export to a private Cloud Storage bucket with retention and restricted access.

Never place exported customer data in this repository, a public bucket, or the production web directory.

## Restore procedure

1. Stop writes or place the application in maintenance mode if active corruption is occurring.
2. Identify the last good backup/export and record its timestamp.
3. Create or use a separate recovery Firebase project.
4. Restore/import the backup into the recovery project first.
5. Validate counts and sample records for users, companies, vehicles, jobs, inventory, installations, certificates, agreements, audit collections, and counters.
6. Confirm Job ID and certificate counters are at least as high as the largest restored identifier.
7. Only after validation, schedule the production restore through Google Cloud Firestore backup/restore or managed import tooling.
8. Re-run critical workflows and preserve the incident record.

Do not test restoration against the live database.

## Safe release procedure

1. Confirm a recent backup exists.
2. Review changes for destructive writes, collection deletes, counter changes, and permission changes.
3. Run type checking, production build, domain tests, and Firestore rule tests.
4. Deploy rules only when required, then deploy hosting.
5. Run Settings → System status and the critical workflow checklist in `DEPLOYMENT.md`.
6. Roll back the hosting release or rules immediately if verification fails.

## Common failures

- **Missing or insufficient permissions:** verify the signed-in user's active technician profile and role, then review Firestore rules. Do not broaden access globally.
- **Stale screen after deployment:** close and reopen the tab once. The current release unregisters older service workers and clears their caches.
- **Offline/database warning:** check network connectivity, Firebase status, and Settings → System status. Firestore local cache can display older data while offline.
- **WhatsApp does not open:** validate the stored UAE-format number and browser pop-up handling.
- **PDF/Excel download fails on mobile:** check native file/share permissions and available device storage.
- **Android update rejected:** confirm package `com.securetrack.fieldoperations`, increasing version code, and the existing SecureTrack signing certificate.

## Security and data integrity

- Secrets and signing keys are ignored by Git. Keep upload keys and passwords in an encrypted company-controlled backup.
- Production emulator mode is blocked outside localhost.
- Firestore rules restrict roles, immutable histories, identifier counters, and public agreement links.
- Job scheduling uses one transactional `schedule_locks` document per technician/day. The same transaction rechecks overlapping start/end times before saving. Job `version` prevents stale edits from overwriting a newer update.
- `assignment_index` provides one transactional owner for each active IMEI and SIM. `technician_live_stock` prevents two completions from consuming the same final stock unit.
- Renewal records use deterministic IDs based on chassis, or company plus vehicle when chassis is absent. Repeated imports update the same current record.
- Never reset Job IDs, certificate IDs, counters, or historical data.
- Check existing data for duplicates before adding stricter constraints. Firestore does not provide traditional SQL unique constraints; atomic counters and transactions must remain in use.

## Staging readiness

The same code can run against a separate Firebase project by using a separate Firebase configuration and environment file. Create separate Authentication, Firestore, Hosting, and test accounts. Do not copy real customer data into staging without explicit approval and secure anonymization.

## External dependencies

Firebase Authentication, Cloud Firestore, Firebase Hosting, WhatsApp web links, device camera/location, local/push notifications, and client-side PDF/Excel libraries. No SMTP service is configured in this checkout.

## Known production risks

- Current per-vehicle completion, inventory, permissions, mixed-work, protected error-log, audit, scheduling, renewal and notification rules must pass the Firestore emulator suite before deployment. Legacy aggregate completion branches remain only for compatibility and should not be expanded.
- The main production JavaScript bundle is about 2.95 MB before compression. It builds successfully, but future maintenance should split large document and spreadsheet features into lazy-loaded chunks to improve first load on slower mobile devices.
- Automated Firestore backups remain disabled until billing is enabled by the owner.

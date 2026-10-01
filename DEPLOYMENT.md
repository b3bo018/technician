# SecureTrack deployment

## Build and deploy

1. Confirm the latest Firestore backup or export completed successfully.
2. Copy `.env.example` to `.env.local` and supply environment-specific values. Never commit `.env.local`.
3. Run `pnpm install --frozen-lockfile`, `pnpm run build`, and `pnpm test`.
4. When rules changed, run `pnpm run test:rules` against the local emulator before deployment.
5. Deploy rules only after their tests pass: `firebase deploy --only firestore:rules --project securetrack-technician-b3bo018`.
6. Deploy hosting with `firebase deploy --only hosting --project securetrack-technician-b3bo018`.

The Android shell uses the same built web application. Increase `versionCode`, build the web app, run `npx cap sync android`, and create a signed release with the existing SecureTrack key. Never replace the key.

## Required environment variables

- `VITE_BUSINESS_TIME_ZONE`
- `VITE_USE_EMULATORS` for local development only

Firebase client configuration is held in `firebase-applet-config.json`. Firebase web API keys identify the project and are not administrator credentials; authorization is enforced by Authentication and Firestore rules.

## Database changes

This project uses Firestore and has no destructive automatic migrations. The production-hardening release adds `audit_events`, `schedule_locks`, `assignment_index`, `technician_live_stock`, `operational_notifications`, and `renewals`. Existing jobs, counters, certificates, agreements and history are not rewritten. Technician live stock is initialized once from the existing opening balance and immutable movement log, then maintained transactionally. Never reset counters or historical collections. Test rule and data changes with emulators first.

No manual data migration is required. The first renewal Excel import creates deterministic renewal records. Existing certificate and agreement records continue to work; new soft-delete fields are added only when a record is archived.

## Verification

- Sign in with a non-production test account.
- Check Settings → System status.
- Verify draft and scheduled job creation, overlap rejection, stale-edit rejection, technician view, unique IMEI/SIM assignment, per-vehicle completion notification, stock deduction, online verification, renewal import preview, audit restore, certificates, agreements, attendance export, and global search.
- Check the browser console and protected `error_logs` collection for new errors.

## Rollback

1. In Firebase Hosting release history, roll back to the last verified release.
2. If rules caused the failure, redeploy the last known-good `firestore.rules` from version control.
3. Do not restore Firestore merely to undo a UI deployment. Restore data only for confirmed data loss or corruption.
4. Re-run the critical workflow checks after rollback.

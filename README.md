# SecureTrack Field Operations

SecureTrack is a role-based field operations PWA for technicians, administrators, managers, accountants, HR, and IT staff.

## AWS architecture

The migration branch `migration/remove-firebase-aws` runs without Firebase in the application runtime.

- React 19 + TypeScript + Vite frontend
- AWS Amplify Hosting for the web application
- Amazon Cognito for authentication
- SecureTrack Node/Express API in `server/`
- Amazon RDS/Aurora PostgreSQL for operational data
- Capacitor Android shell for the mobile application
- localForage for the technician offline outbox

The existing screens and workflows are preserved through the AWS document-store compatibility layer in `src/lib/cloud/`.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm run check:firebase
pnpm run server:build
```

Set `VITE_API_URL` to the deployed SecureTrack AWS API. See `AWS-MIGRATION.md` for infrastructure and cutover steps.

## Important migration note

The source migration does not itself copy production records or passwords. Existing Firestore records must be exported/imported into PostgreSQL before cutover. Firebase Authentication passwords cannot be directly copied to Cognito; use a controlled reset, temporary-password, or migration flow.

Do not delete the existing production Firebase project until AWS data reconciliation, account access, and critical workflow verification are complete.

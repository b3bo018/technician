# SecureTrack AWS deployment

## Target

- Frontend: AWS Amplify Hosting
- Authentication: Amazon Cognito
- API: `server/` Node/Express service
- Database: Amazon RDS/Aurora PostgreSQL
- Frontend domain: `connect.securetrackgo.com`
- API domain: `api.securetrackgo.com`

## Deployment sequence

1. Create the Cognito User Pool and public app client. Enable email sign-in, `USER_PASSWORD_AUTH`, `REFRESH_TOKEN_AUTH`, and email account recovery.
2. Create RDS/Aurora PostgreSQL in private networking and run `server/sql/001_documents.sql`.
3. Deploy `server/` with private database connectivity and server-side values for `DATABASE_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, and `AWS_REGION`.
4. Configure Amplify with `VITE_API_URL` and `VITE_SYNC_INTERVAL_MS`.
5. Build and verify:
   ```bash
   pnpm install --frozen-lockfile
   pnpm run check:firebase
   pnpm test
   pnpm build
   pnpm run server:build
   ```
6. Export existing Firestore production records and import them into PostgreSQL while preserving collection names and document IDs.
7. Create/migrate Cognito users using a controlled password migration strategy.
8. Reconcile counts and sample records for users, jobs, inventory, attendance, certificates, renewals, agreements, notifications, and audit history.
9. Test login, account creation/reset, job scheduling/completion, stock transactions, attendance, certificates, renewals, agreements/public signing, reports, notifications, and Android access.
10. Switch DNS only after acceptance testing succeeds.

## Rollback

Keep the existing Firebase production system unchanged during migration. If AWS acceptance testing fails, keep DNS/application traffic on the existing production deployment. Do not delete production Firebase data until the AWS system is verified and backups are retained.

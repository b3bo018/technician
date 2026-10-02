# SecureTrack Firebase → AWS migration

This branch removes Firebase from the web application's runtime while preserving the existing React UI and business workflows through an AWS-backed compatibility layer.

## Target
- Frontend: AWS Amplify Hosting
- Authentication: Amazon Cognito User Pool
- API: server/ Node service
- Database: Amazon RDS/Aurora PostgreSQL
- Frontend domain: connect.securetrackgo.com
- API domain: api.securetrackgo.com

## Setup
1. Create a Cognito User Pool with email sign-in and a public app client without a client secret. Enable USER_PASSWORD_AUTH and REFRESH_TOKEN_AUTH and email account recovery.
2. Create PostgreSQL in RDS/Aurora and run server/sql/001_documents.sql.
3. Deploy server/ in a service with private database connectivity. Put DATABASE_URL, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID and AWS_REGION in server-side secrets/environment only.
4. Set VITE_AWS_REGION, VITE_COGNITO_CLIENT_ID and VITE_API_URL in Amplify.
5. Import existing Firestore documents into PostgreSQL preserving collection names and document IDs. Verify users, jobs, inventory, attendance, certificates, renewals, agreements and audit history before cutover.

## Important
Existing Firebase passwords cannot simply be copied into Cognito. Plan a password reset/temporary-password or Cognito migration flow. Do not delete Firebase production data until AWS data and user access are verified. This branch is migration code; production cutover still requires AWS resources and live-data migration.

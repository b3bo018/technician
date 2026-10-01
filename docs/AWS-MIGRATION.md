# SecureTrack AWS API contract

This branch removes Firebase from the browser/mobile runtime. The client now expects an authenticated AWS API at `VITE_API_URL`.

## Recommended AWS services
- Amazon Cognito User Pool for login/password reset.
- API Gateway + Lambda (or ECS/Fargate) for `/v1/*`.
- Amazon RDS PostgreSQL for application data.
- S3 for files/exports where required.
- CloudWatch for logs.
- SNS/Pinpoint/FCM bridge only if remote Android push is required.

## Required API routes
Authentication:
- POST /v1/auth/login
- POST /v1/auth/refresh
- POST /v1/auth/logout
- POST /v1/auth/forgot-password
- POST /v1/admin/users
- POST /v1/admin/users/delete

Data compatibility API:
- GET /v1/store/doc/:encodedPath
- PUT /v1/store/doc/:encodedPath
- PATCH /v1/store/doc/:encodedPath
- DELETE /v1/store/doc/:encodedPath
- POST /v1/store/collection/:encodedPath
- POST /v1/store/query
- POST /v1/store/batch
- POST /v1/store/transaction

The server MUST derive identity/role from the verified Cognito JWT. Never trust a role or UID supplied by the browser for authorization.

## Migration rule
Do not delete Firestore data until PostgreSQL row/document counts and business-critical records have been verified and the AWS production deployment has passed acceptance testing. Keep the original branch as rollback.

# SecureTrack Field Operations

SecureTrack is a role-based field operations PWA for technicians, administrators, managers, accountants, HR, and IT staff. The production application is hosted at [track-technician-b3bo018-f1603.web.app](https://track-technician-b3bo018-f1603.web.app/).

## Current source and local hosting

The complete working interface is on branch `revamp/scheduled-attendance-inventory`. Use this branch on another computer to obtain the current screens, styles, certificate templates, logos, and workflows. Earlier committed copies did not include all updates made after 24 September 2026.

This source still uses Firebase Authentication and Firestore. Running Vite on a local computer only hosts the frontend; it does **not** create a local database or remove Firebase quotas. The independent local-server migration is not complete. Preserve the existing React screens and assets when changing the backend.

Clone into a new folder rather than overwriting another local-server project or its database:

```bash
git clone --branch revamp/scheduled-attendance-inventory https://github.com/b3bo018/technician.git
cd technician
pnpm install
pnpm dev
```

Credentials, signing keys, local SDKs, caches, exports, and generated builds are intentionally excluded. Business records and user accounts live in the database and are not part of a Git clone.

## Current features

- Administrator-created accounts and role-based workspaces
- Technician schedules with customer, contact, vehicle, location, notes, and job type
- GPS login and site-arrival records
- QR device IMEI and SIM barcode scanning from the rear camera
- Technician inventory with administrator/accountant stock issuance and automatic deductions at completion
- Daily, weekly, and monthly reporting with Excel export
- HR performance, duration, overtime, and score views
- Profile photos, responsive mobile layouts, and PWA installation
- Signed Android APK/AAB support through Capacitor

## Stack

- React 19, TypeScript, and Vite
- Firebase Authentication, Cloud Firestore, and Firebase Hosting
- Web app manifest and install prompt; older service workers are removed by the current app
- ZXing WASM through `barcode-detector`
- ExcelJS for reports
- localForage for the technician outbox

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

The local app runs at `http://127.0.0.1:3000/`.

## Deployment

```bash
pnpm build
firebase deploy --only hosting,firestore:rules --project securetrack-technician-b3bo018
```

Firebase Hosting enforces HTTPS, HSTS, a restrictive Content Security Policy, frame blocking, limited camera/location permissions, and no-cache rules for the PWA update files. Firestore access is enforced by `firestore.rules`.

## Android releases

The current Capacitor Android package ID is `com.securetrack.fieldoperations` (version 1.2.8, version code 11). The older `native-android/` project is a legacy wrapper and is not the current APK build target.

The private signing key and `android/securetrack-signing.properties` are deliberately excluded from Git. Obtain the existing signing setup from the owner's private backup before building a signed update. Future Android releases must reuse that key and increment the version code; do not generate a replacement key.

# SecureTrack Field Operations

SecureTrack is a role-based field operations PWA for technicians, administrators, managers, accountants, HR, and IT staff. The production application is hosted at [track-technician-b3bo018-f1603.web.app](https://track-technician-b3bo018-f1603.web.app/).

## Current features

- Administrator-created accounts and role-based workspaces
- Technician schedules with customer, contact, vehicle, location, notes, and job type
- GPS login and site-arrival records
- QR device IMEI and SIM barcode scanning from the rear camera
- Technician inventory with administrator/accountant stock issuance and automatic deductions at completion
- Daily, weekly, and monthly reporting with Excel export
- HR performance, duration, overtime, and score views
- Profile photos, responsive mobile layouts, and PWA installation
- Signed Android APK/AAB support through a Trusted Web Activity

## Stack

- React 19, TypeScript, and Vite
- Firebase Authentication, Cloud Firestore, and Firebase Hosting
- Workbox through `vite-plugin-pwa`
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

The Android package ID is `com.securetrack.technician`. The public Digital Asset Link is versioned at `public/.well-known/assetlinks.json`.

The private signing key is deliberately excluded from Git. Its encrypted backup and the current APK/AAB are stored in the owner's private OneDrive folder under `Documents/SecureTrack Private Backup/Android v2.0.0`. Future Android releases must reuse that key and increment both the version and version code.

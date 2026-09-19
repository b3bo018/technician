# SecureTrack release checklist

1. Run `pnpm test`, `pnpm lint`, and `pnpm build`.
2. Review changes to `firestore.rules`; technician data must remain scoped to the signed-in account.
3. Deploy hosting and rules to `securetrack-technician-b3bo018`.
4. Verify email login, automatic location capture, technician schedules, stock issuance, completion deductions, camera scanning, reports, and role restrictions.
5. Confirm `/.well-known/assetlinks.json` returns JSON directly with HTTP 200.
6. For Android updates, restore the private signing archive from the owner's OneDrive backup, reuse the same keystore, increment the Android version code, sign the release, and delete the restored plaintext files afterward.

Never commit `.env` files, signing keys, signing credentials, Firebase CLI caches, or generated release packages.

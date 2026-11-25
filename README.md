# Mahdi Barbershop

Mahdi Barbershop is a French-language Expo Android booking client paired with a TypeScript/Express/PostgreSQL API. The existing dark luxury-barber UI and API architecture are preserved.

## Production backend deployment

1. Provision PostgreSQL 16 or a compatible PostgreSQL service with the `pgcrypto` and `btree_gist` extensions available. Create a dedicated database and least-privilege runtime user.
2. Copy `server/.env.example` into a secret manager or runtime environment; do not commit `.env`. Set `NODE_ENV=production`, the provider `DATABASE_URL`, `PGSSL=true` when the provider requires TLS, `PG_POOL_MAX`, and a randomly generated `JWT_SECRET` of at least 32 characters. Set non-default `ADMIN_PHONE` and `ADMIN_PASSWORD` through the secret manager.
3. `CORS_ORIGIN` is optional because this release has no web frontend. If browser access is later needed, set it to comma-separated HTTPS origins. Native Android requests with no `Origin` header are allowed; a production `*` value is rejected.
4. From the repository checkout, install and build the server, then apply migrations in order: `cd server && npm ci && npm run migrate && npm run build`. The migration runner applies `server/db/migrations/001_initial.sql`, `002_notifications_and_migration_log.sql`, and `003_fix_overlap_constraint.sql`, and `004_seed_missing_working_hours.sql` once and records versions in `schema_migrations`.
5. Start only the compiled server with `npm start`. The process runs the admin bootstrap, emits JSON request/startup/error logs, and handles `SIGTERM`/`SIGINT` gracefully. Put it behind HTTPS and a process supervisor/container platform.
6. Verify `GET https://<api-host>/health` returns `{ "ok": true, "service": "mahdi-api" }` and `GET https://<api-host>/ready` returns a database-ready response. `/ready` is the deployment readiness probe; `/health` is the liveness probe.

Production startup fails closed if `DATABASE_URL`, a 32+ character `JWT_SECRET`, or admin credentials are missing. Provider credentials belong only in runtime secret storage. The Docker build uses `npm ci`, and `server/.dockerignore` excludes environment files and development artifacts.

## Expo / EAS setup

1. Install the EAS CLI in the build environment: `npm install --global eas-cli`, then authenticate with `eas login` or an `EXPO_TOKEN` environment variable. Never commit the token.
2. From `mobile/`, run `eas init`. This writes the real EAS project ID into the Expo configuration. No project ID is currently committed because no authenticated EAS project was available in this environment.
3. Confirm `com.mahdi.barbershop` remains the Android package identifier and run `npx expo-doctor`.
4. Build with the production API URL injected at build time: `EXPO_PUBLIC_API_URL=https://mahdi-barbershop-api.onrender.com eas build --platform android --profile preview` for an internal APK, or `EXPO_PUBLIC_API_URL=https://mahdi-barbershop-api.onrender.com eas build --platform android --profile production` for an AAB. The checked-in EAS profiles also provide this value. The preview profile is `distribution: internal` with `android.buildType: apk`; production uses `android.buildType: app-bundle`.
5. Install the completed preview APK on a physical Android device, test the release checklist below, and retain the real EAS build URL and artifact metadata. No APK URL is claimed until an authenticated build completes and its artifact is verified.

## Push notifications and FCM V1

1. Create a Firebase project and register the Android app with package name `com.mahdi.barbershop`. Enable Firebase Cloud Messaging.
2. In Google Cloud IAM, create a dedicated service account with the Firebase Cloud Messaging API permissions required by EAS, generate its JSON key once, and store it only in a password manager/secret transfer.
3. Run `eas credentials` from `mobile/` and configure Android FCM V1 using the service-account JSON through EAS. Do not commit or paste the JSON into the repository.
4. The app creates the Android notification channel `mahdi-bookings` (`Réservations`) before requesting notification permission and declares `POST_NOTIFICATIONS`. On a physical customer or barber device, grant permission and launch the app; it obtains an Expo token using the real EAS project ID and registers it at `/api/notifications/register-device`.
5. Configure the server's optional `EXPO_ACCESS_TOKEN` only in runtime secrets when the Expo Push Service project requires authenticated requests. The backend persists `SENT`, `FAILED`, provider receipt IDs, and provider error messages in PostgreSQL.
6. Test delivery by registering one customer and one barber device, creating a booking, confirming it from the admin account, and checking both device notifications and `/api/admin/notifications`. Invalid token formats return HTTP 400; provider errors are stored as `FAILED` and must be retried/removed according to the provider response.

## Release validation checklist

- [ ] Production API is reachable over HTTPS and `/health` plus `/ready` pass.
- [ ] Guest customer can load services and availability.
- [ ] Guest can book one service and multiple services; totals and duration are correct.
- [ ] Adjacent bookings are accepted and overlapping/concurrent bookings return a conflict.
- [ ] Invalid Algerian phones and invalid customer data are rejected.
- [ ] Admin authentication succeeds only with the configured credentials; unauthorized admin requests are rejected.
- [ ] Admin can edit working hours, block/unblock slots, and full-day availability changes persist.
- [ ] Admin can update booking statuses and invalid transitions are rejected.
- [ ] Device registration, notification delivery, invalid-token handling, and provider-failure persistence are verified on physical devices.
- [ ] Release APK installs on a physical Android device, reaches the production API, and survives app restart.

## Verified state and blockers

The repository previously passed the mobile TypeScript check, Expo Doctor 20/20 checks, backend build, and the verified 14-test backend/PostgreSQL suite. Phase 3 adds production configuration validation, structured logging, `/ready`, a migration runner, lockfile-based Docker installs, and this deployment checklist. The production API read-only smoke checks also passed. EAS project initialization, FCM credentials, APK generation, and physical-device verification require external credentials and infrastructure and are not claimed as completed here.

# Mahdi Barbershop API

Copy `.env.example` to a local secret file, start PostgreSQL with `docker compose up -d db` when Docker is available, install with `npm ci`, apply all migrations with `npm run migrate`, build with `npm run build`, run `npm start`, and check `GET /health` plus `GET /ready`.

For production, set `NODE_ENV=production`, a TLS-capable `DATABASE_URL`, a 32+ character `JWT_SECRET`, and non-default admin credentials in the runtime secret manager. `CORS_ORIGIN` is optional when only the native Android app is deployed; native requests without an `Origin` header are allowed. If browser clients are added, set comma-separated allowed origins. Wildcard `*` is rejected in production, and allowed preflight `OPTIONS` requests are handled by the CORS middleware. The API never embeds mobile secrets.

`npm run migrate` applies the ordered SQL files and records versions in `schema_migrations`; the runner is safe to repeat after successful migrations. `/health` is a liveness endpoint and `/ready` verifies database connectivity. JSON request/startup/error logs include request IDs, while production responses hide internal 5xx details.

Push delivery remains credential-gated: the device-token endpoint is real and persistent, but Expo/EAS/FCM credentials and physical-device testing are required before claiming live notifications.

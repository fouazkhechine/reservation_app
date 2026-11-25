# Mahdi Barbershop — implementation plan

## Current audit

The repository has two surfaces: a Vite/Figma Make web preview and an Expo React Native app in `mobile/`. The mobile app already establishes the intended French luxury-barber visual language, but all services, bookings, dashboard values, availability, and authentication are local hardcoded state. There is no backend, database schema, migration system, or real notification integration.

## Architecture

- **Mobile:** Expo SDK 58, React Native, TypeScript, existing single-entry navigation retained for this incremental conversion. API calls live in `mobile/lib/api.ts`; `expo-secure-store` holds access tokens.
- **Backend:** Node.js + Express + TypeScript in `server/`, with Zod request validation, bcrypt password hashing, JWT access tokens, Helmet, CORS and rate limiting.
- **Database:** PostgreSQL with SQL migrations in `server/db/migrations/`. Booking overlap protection uses a PostgreSQL exclusion constraint on a `tstzrange` for all non-cancelled/non-rejected reservations, so concurrent inserts cannot double-book a barber.
- **Notifications:** Device token persistence and a notification abstraction are included; actual FCM/Expo credentials remain environment-supplied and are not faked.
- **Operations:** Docker Compose provides PostgreSQL and the API locally. `.env.example` documents required values.

## Incremental delivery

1. Add the backend contract, schema, migrations, seed data, auth, services, availability, bookings, admin status updates and device-token registration.
2. Replace the mobile app's fake auth and booking submission with API-backed flows while preserving the existing UI.
3. Add automated API/service tests for validation, totals and overlap handling.
4. Add push provider credentials and Android release configuration only when supplied; an APK cannot honestly be claimed until an EAS/native build is run.

## Design direction

- **Design Movement:** Modern luxury editorial barber studio (chosen).
- **Core Principles:** dark negative space, warm metallic accent, editorial hierarchy, one-handed action placement.
- **Color Philosophy:** near-black surfaces create the premium studio atmosphere; restrained gold marks the brand and actionable moments; warm off-white keeps long booking forms readable.
- **Layout Paradigm:** immersive hero and stacked editorial cards, with persistent bottom actions for booking flow.
- **Signature Elements:** gold hair-shear mark, uppercase micro-labels, and warm-gold progress/confirmation states.
- **Interaction Philosophy:** selection is explicit and reversible; backend success, not optimistic UI, controls confirmation.
- **Animation:** use native pressed opacity and short state transitions; avoid decorative motion that competes with booking actions.
- **Typography System:** bold geometric sans for headings and compact uppercase labels; italic serif accent for emotional phrases.
- **Brand Essence:** a premium at-home barber service for Alger clients who want studio-quality grooming at their door. Personality: precise, warm, elevated.
- **Brand Voice:** direct French microcopy with confident hospitality. Examples: “Votre style, chez vous.” and “On vous attend — réservation reçue.”
- **Wordmark & Logo:** MAHDI wordmark paired with a minimal shear emblem.
- **Signature Brand Color:** `#C9A45C` antique gold.

## Project structure

```text
mobile/                 Expo React Native client
  App.tsx               existing screens, progressively API-backed
  lib/api.ts            typed API client and token storage
server/                 Express API
  src/index.ts          HTTP server, routes, validation, auth and booking logic
  db/migrations/        PostgreSQL schema and seed migration
  .env.example          non-secret configuration contract
  Dockerfile            production API image
  package.json          server scripts/dependencies
 docker-compose.yml      local PostgreSQL + API
```

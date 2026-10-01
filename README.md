# Neighborhood ELO / NYCELO

This repository is a Replit-independent copy of the complete NYCELO app. It
contains the React frontend, Express API, ranking logic, neighborhood data,
maps, image assets, database schema, and seed data.

## Run locally

Requirements: Node.js 22+ and pnpm 11+.

```sh
pnpm install
pnpm run dev
```

Open `http://127.0.0.1:5173`. The first run creates a persistent embedded
PostgreSQL-compatible database in `.local/nycelo-pgdata`, creates the schema,
and seeds 178 neighborhoods plus 14 ranking traits. No Replit account or paid
database is required.

## Use an external PostgreSQL database

Set `DATABASE_URL` before starting the app. When it is present, the original
PostgreSQL driver and behavior are used. Initialize that database with:

```sh
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-nycelo
```

## Verification

```sh
pnpm run typecheck
pnpm run build
```

The frontend defaults to port 5173, the API defaults to port 5000, and the
frontend development server proxies `/api` to the API. `PORT` and `BASE_PATH`
remain supported for hosted environments.

## Replit compatibility

The repository still includes `.replit` and the optional Replit development
plugins, so it can be reopened there later. Replit supplies `DATABASE_URL`; the
same code automatically uses that external database when the variable exists.

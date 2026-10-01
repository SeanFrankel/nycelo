# NYCELO

> Codex migration note: this project no longer requires Replit to run. With no
> `DATABASE_URL`, it uses a persistent embedded PostgreSQL-compatible database
> under `.local/`. Supplying `DATABASE_URL` preserves the original external
> PostgreSQL behavior.

An interactive web app that crowdsources NYC neighborhood rankings across traits (dining, walkability, subway access, etc.) via head-to-head ELO matchups.

## Run & Operate

- `pnpm run dev` — initialize/seed the local database and run the API (5000) plus frontend (5173)
- `pnpm run setup:local` — initialize and idempotently seed the local database only
- `pnpm --filter @workspace/api-server run dev` — run only the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-nycelo` — seed traits + neighborhoods (idempotent; skips if data exists)
- Optional env: `DATABASE_URL` — external Postgres connection string; omit for the local embedded database
- Optional env: `LOCAL_DATABASE_DIR` — override the local database directory

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (`artifacts/nycelo`), wouter, TanStack Query, react-leaflet, Tailwind
- API: Express 5 (`artifacts/api-server`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- API contract: `lib/api-spec/openapi.yaml` (source of truth; re-run codegen after edits)
- DB schema: `lib/db/src/schema/` (neighborhoods, traits, ratings, votes)
- ELO engine: `artifacts/api-server/src/lib/elo.ts` (K=32, draws = 0.5, skips untouched)
- API routes: `artifacts/api-server/src/routes/nycelo.ts`
- Frontend pages: `artifacts/nycelo/src/pages/` (home, rank, leaderboard)
- Seed data: `scripts/src/seed-nycelo.ts` (178 neighborhoods, 14 traits)
- Neighborhood photos: `artifacts/nycelo/public/images/vibes/*.jpg` — 14 AI-generated "vibe" images shared across neighborhoods; `photoUrl` in DB is a path relative to the app base

## Architecture decisions

- Ratings are per neighborhood **per trait** (unique index on `neighborhood_id, trait_id`), lazily created at 1500 on first matchup.
- Matchup selection: contender A random; contender B chosen by nearest ELO rating plus random jitter, for competitive duels.
- Voting is anonymous and global — no accounts; every vote is a row in `votes`, `skip` outcomes recorded but leave ratings untouched.
- Codegen quirks: avoid `type: integer` in OpenAPI bodies/responses (generates zod-v4-only `zod.int()`); avoid path params whose zod name collides with query-param types — use query params.
- Design language: "Subway Brutalism" — safety orange / MTA blue & yellow, Bricolage Grotesque + Space Mono, hard edges, offset shadows.

## Product

- Home: rotating showcase of current #1 per trait, global stats, CTA.
- /rank: two-neighborhood duel for one trait with photos, shared Leaflet map, vote / too-hard-to-tell (draw) / skip.
- /leaderboard: per-trait standings with borough filters, W/L/D and ratings.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run codegen before touching generated types.
- The seed script exits early if neighborhoods exist; truncate tables first to re-seed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

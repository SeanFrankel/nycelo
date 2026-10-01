import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function findWorkspaceRoot() {
  let current = process.cwd();
  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

const localSchema = `
  CREATE TABLE IF NOT EXISTS neighborhoods (
    id serial PRIMARY KEY,
    name text NOT NULL,
    borough text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    photo_url text,
    blurb text,
    popularity integer NOT NULL DEFAULT 2
  );
  CREATE TABLE IF NOT EXISTS traits (
    id serial PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL,
    emoji_hint text
  );
  CREATE TABLE IF NOT EXISTS voters (
    id serial PRIMARY KEY,
    token text NOT NULL UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS ratings (
    id serial PRIMARY KEY,
    neighborhood_id integer NOT NULL REFERENCES neighborhoods(id),
    trait_id integer NOT NULL REFERENCES traits(id),
    rating double precision NOT NULL DEFAULT 1500,
    games_played integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    draws integer NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ratings_neighborhood_trait_idx
    ON ratings(neighborhood_id, trait_id);
  CREATE TABLE IF NOT EXISTS votes (
    id serial PRIMARY KEY,
    trait_id integer NOT NULL REFERENCES traits(id),
    neighborhood_a_id integer NOT NULL REFERENCES neighborhoods(id),
    neighborhood_b_id integer NOT NULL REFERENCES neighborhoods(id),
    outcome text NOT NULL,
    voter_id integer REFERENCES voters(id),
    weight double precision NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS experience (
    id serial PRIMARY KEY,
    voter_id integer NOT NULL REFERENCES voters(id),
    neighborhood_id integer NOT NULL REFERENCES neighborhoods(id),
    visits integer NOT NULL DEFAULT 0,
    hours double precision NOT NULL DEFAULT 0,
    photos integer NOT NULL DEFAULT 0,
    activities integer NOT NULL DEFAULT 0,
    checkins integer NOT NULL DEFAULT 0,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS experience_voter_neighborhood_idx
    ON experience(voter_id, neighborhood_id);
`;

export const usingLocalDatabase = !process.env.DATABASE_URL;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

const localDatabaseDir =
  process.env.LOCAL_DATABASE_DIR ??
  path.join(findWorkspaceRoot(), ".local", "nycelo-pgdata");

if (usingLocalDatabase) mkdirSync(path.dirname(localDatabaseDir), { recursive: true });

const localClient = usingLocalDatabase
  ? new PGlite(localDatabaseDir)
  : null;

// Both adapters implement the same Drizzle PostgreSQL query surface. Keep the
// public type stable so the rest of the application remains adapter-agnostic.
export const db = (pool
  ? drizzleNodePostgres(pool, { schema })
  : drizzlePglite(localClient!, { schema })) as ReturnType<
  typeof drizzleNodePostgres<typeof schema>
>;

export const dbReady = localClient
  ? localClient.exec(localSchema).then(() => undefined)
  : Promise.resolve();

export * from "./schema";

#!/usr/bin/env node
/**
 * Runs a Prisma command against the schema that matches the current database.
 *
 * Prisma bakes the datasource provider into the generated client, so a single
 * schema cannot serve both local SQLite and production Postgres. Instead:
 *
 *   DATABASE_URL=file:...            -> prisma/schema.prisma          (SQLite)
 *   DATABASE_URL=postgres(ql)://...  -> prisma/schema.postgres.prisma (Postgres)
 *
 * The two schema files are kept identical apart from the datasource, and
 * test/schema-parity.test.ts fails if they ever drift.
 *
 * Usage: node scripts/run-prisma.mjs <command> [args...]
 *   node scripts/run-prisma.mjs generate
 *   node scripts/run-prisma.mjs db push
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Mirror the Prisma CLI: it loads .env before resolving env vars.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // A malformed .env should not stop a generate; Prisma will report it.
  }
}

const url = String(process.env.DATABASE_URL || "").trim();
const usePostgres =
  /^postgres(ql)?:\/\//i.test(url) || process.env.PRISMA_TARGET === "postgres";

const schema = usePostgres
  ? "prisma/schema.postgres.prisma"
  : "prisma/schema.prisma";

/**
 * Schema commands (db push / migrate) run DDL, which Neon's pooled endpoint
 * (PgBouncer) does not reliably support. Neon uses the same host without the
 * "-pooler" suffix for direct connections, so derive that for DDL commands.
 * Runtime queries keep using whatever URL the dashboard provides.
 */
const args = process.argv.slice(2);
const isSchemaCommand =
  args[0] === "migrate" || (args[0] === "db" && args[1] === "push");

let childEnv = process.env;
if (isSchemaCommand && usePostgres && url.includes("-pooler.")) {
  try {
    const direct = new URL(url);
    direct.hostname = direct.hostname.replace("-pooler.", ".");
    direct.searchParams.delete("pgbouncer");
    childEnv = { ...process.env, DATABASE_URL: direct.toString() };
    console.log("[prisma] Using the direct Neon endpoint for schema changes.");
  } catch {
    // Fall back to the URL as provided; Prisma will report any problem.
  }
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binary = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);

if (!existsSync(binary)) {
  console.error('[prisma] Prisma CLI not found. Run "npm install" first.');
  process.exit(1);
}

const result = spawnSync(binary, [...args, "--schema", schema], {
  stdio: "inherit",
  env: childEnv,
  cwd: projectRoot,
  shell: false,
});

if (result.error) {
  console.error(
    `[prisma] Could not start "${binary}". Run "npm install" first.`,
    result.error.message
  );
  process.exit(1);
}

process.exit(result.status ?? 1);

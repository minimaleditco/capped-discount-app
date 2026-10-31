import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Production runs on Postgres (Neon) while local development and tests run on
 * SQLite. Prisma picks the provider from the schema file, so the app keeps two
 * schema files that must describe exactly the same tables.
 *
 * This test is the safety net: if a column is added to one file and not the
 * other, `npm test` fails instead of production breaking at runtime.
 */
function modelsFrom(file: string): Record<string, string[]> {
  const source = readFileSync(file, "utf8");
  const models: Record<string, string[]> = {};

  for (const match of source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const name = match[1];
    const body = match[2]
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, "").trim())
      .filter(Boolean)
      .map((line) => line.replace(/\s+/g, " "));
    models[name] = body;
  }

  return models;
}

describe("Prisma schema parity (SQLite dev/test vs Postgres production)", () => {
  const sqlite = modelsFrom("prisma/schema.prisma");
  const postgres = modelsFrom("prisma/schema.postgres.prisma");

  it("defines the same models in both schemas", () => {
    expect(Object.keys(postgres).sort()).toEqual(Object.keys(sqlite).sort());
  });

  it("keeps every field, default and index identical", () => {
    for (const model of Object.keys(sqlite)) {
      expect(postgres[model], `model ${model} differs between the two schemas`).toEqual(
        sqlite[model]
      );
    }
  });

  it("only differs in the datasource provider and url", () => {
    const datasource = (file: string) =>
      readFileSync(file, "utf8").match(/datasource\s+db\s*\{[\s\S]*?\}/)?.[0] ?? "";

    const sqliteBlock = datasource("prisma/schema.prisma");
    const postgresBlock = datasource("prisma/schema.postgres.prisma");

    expect(sqliteBlock).toContain('provider = "sqlite"');
    expect(postgresBlock).toContain('provider = "postgresql"');
    expect(postgresBlock).toContain('url      = env("DATABASE_URL")');
  });
});

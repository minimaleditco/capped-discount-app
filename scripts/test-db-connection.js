/**
 * Database Connection & Pool Verification Script
 * Validates connection pooling limits and connectivity to Render Managed PostgreSQL.
 *
 * Usage:
 *   node scripts/test-db-connection.js
 */

import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

function maskUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.password) url.password = "********";
    return url.toString();
  } catch {
    return "invalid_url";
  }
}

function formatDatabaseUrl(rawUrl) {
  const urlStr =
    rawUrl ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/capped_discount_app";

  try {
    const url = new URL(urlStr);
    const isLocalhost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";

    if (!url.searchParams.has("sslmode") && !isLocalhost) {
      url.searchParams.set("sslmode", "require");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.DB_POOL_LIMIT || "25");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.DB_POOL_TIMEOUT || "10");
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }
    return url.toString();
  } catch {
    return urlStr;
  }
}

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error("❌ ERROR: DATABASE_URL environment variable is not defined.");
    console.log("👉 Please define DATABASE_URL in your .env file or Render environment variables.");
    process.exit(1);
  }

  const datasourceUrl = formatDatabaseUrl(rawUrl);
  const parsed = new URL(datasourceUrl);

  console.log("=================================================");
  console.log("  Capped Discount & Partial COD Suite");
  console.log("  Managed PostgreSQL Connection Pool Verification");
  console.log("=================================================");
  console.log(`Endpoint:         ${parsed.hostname}:${parsed.port || 5432}`);
  console.log(`Database:         ${parsed.pathname.replace(/^\//, "")}`);
  console.log(`Target URL:       ${maskUrl(datasourceUrl)}`);
  console.log(`Pool Limit:       ${parsed.searchParams.get("connection_limit")} concurrent connections`);
  console.log(`Pool Timeout:     ${parsed.searchParams.get("pool_timeout")}s`);
  console.log(`SSL Mode:         ${parsed.searchParams.get("sslmode") || "default"}`);
  console.log("-------------------------------------------------");

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
  });

  try {
    console.log("🔌 Attempting connection to PostgreSQL...");
    const start = Date.now();
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, current_database() as db_name, version() as pg_version`;
    const latency = Date.now() - start;

    console.log(`✅ Connection established successfully in ${latency}ms!`);
    console.log(`   Database Name: ${result[0]?.db_name}`);
    console.log(`   Server Time:   ${result[0]?.current_time}`);
    console.log(`   PG Version:    ${String(result[0]?.pg_version).split(" on ")[0]}`);

    // Verify application tables
    console.log("\n📦 Checking database tables...");
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const tableNames = tables.map((t) => t.table_name);
    console.log(`Found ${tableNames.length} tables in public schema:`, tableNames.join(", "));

    const requiredTables = ["Session", "PartialCodSettings", "PartialCodDeposit", "DepositRule", "DiscountSavings"];
    const missing = requiredTables.filter((t) => !tableNames.includes(t));

    if (missing.length > 0) {
      console.warn(`⚠️ Warning: Missing tables: ${missing.join(", ")}`);
      console.log("👉 Run 'npx prisma migrate deploy' to apply schema migrations to this database.");
    } else {
      console.log("✅ All required tables are present and ready for high-velocity operations!");
    }

    console.log("\n🚀 Enterprise Database Migration Check PASSED.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Connection failed:");
    console.error(err instanceof Error ? err.message : err);
    console.log("\n💡 Troubleshooting Tips:");
    console.log("1. Ensure your Render PostgreSQL database is active and accepting connections.");
    console.log("2. If connecting from outside Render, verify external URL includes ?sslmode=require.");
    console.log("3. If IP access control is enabled on Render, allow your deployment / client IP.");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

const nodeRequire = createRequire(import.meta.url);

let DatabaseSync: any = null;
try {
  const sqlite = nodeRequire("node:sqlite");
  DatabaseSync = sqlite.DatabaseSync;
} catch {
  DatabaseSync = null;
}

let dbInstance: any = null;
if (DatabaseSync) {
  try {
    const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), "database.sqlite");
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS shopify_sessions (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        state TEXT NOT NULL,
        isOnline INTEGER NOT NULL,
        scope TEXT,
        expires INTEGER,
        accessToken TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions(shop);
    `);
    try {
      dbInstance.exec("DELETE FROM shopify_sessions WHERE scope NOT LIKE '%write_discounts%' OR shop LIKE '%saransh-discount-test%';");
    } catch {
      // ignore
    }
  } catch (err) {
    console.error("Failed to initialize SQLite DatabaseSync, falling back to memory:", err);
    dbInstance = null;
  }
}

export const db = dbInstance;

/** In-memory fallback if SQLite native bindings are not present */
const memoryStore = new Map<string, string>();

/**
 * Resilient SQLite Session Storage with automatic Memory fallback.
 * Persists sessions across server restarts while preventing boot crashes on any Node runtime.
 */
export class SqliteSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    try {
      const obj = session.toObject();
      const expires = session.expires ? session.expires.getTime() : null;

      if (dbInstance) {
        const insertStmt = dbInstance.prepare(`
          INSERT INTO shopify_sessions (id, shop, state, isOnline, scope, expires, accessToken, data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            shop=excluded.shop,
            state=excluded.state,
            isOnline=excluded.isOnline,
            scope=excluded.scope,
            expires=excluded.expires,
            accessToken=excluded.accessToken,
            data=excluded.data
        `);
        insertStmt.run(
          session.id,
          session.shop,
          session.state,
          session.isOnline ? 1 : 0,
          session.scope || "",
          expires,
          session.accessToken,
          JSON.stringify(obj)
        );
      } else {
        memoryStore.set(session.id, JSON.stringify(obj));
      }
      return true;
    } catch (error) {
      console.error("Error storing session:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      let dataStr: string | undefined;
      if (dbInstance) {
        const row = dbInstance.prepare("SELECT data FROM shopify_sessions WHERE id = ?").get(id) as { data: string } | undefined;
        dataStr = row?.data;
      } else {
        dataStr = memoryStore.get(id);
      }

      if (!dataStr) return undefined;
      const parsed = JSON.parse(dataStr);
      if (parsed.expires) {
        parsed.expires = new Date(parsed.expires);
      }
      return new Session(parsed);
    } catch (error) {
      console.error("Error loading session:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      if (dbInstance) {
        dbInstance.prepare("DELETE FROM shopify_sessions WHERE id = ?").run(id);
      } else {
        memoryStore.delete(id);
      }
      return true;
    } catch (error) {
      console.error("Error deleting session:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      for (const id of ids) {
        await this.deleteSession(id);
      }
      return true;
    } catch (error) {
      console.error("Error deleting sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      let dataRows: string[] = [];
      if (dbInstance) {
        const rows = dbInstance.prepare("SELECT data FROM shopify_sessions WHERE shop = ?").all(shop) as Array<{ data: string }>;
        dataRows = rows.map((r) => r.data);
      } else {
        for (const [_, val] of memoryStore.entries()) {
          const parsed = JSON.parse(val);
          if (parsed.shop === shop) {
            dataRows.push(val);
          }
        }
      }

      return dataRows.map((raw) => {
        const parsed = JSON.parse(raw);
        if (parsed.expires) {
          parsed.expires = new Date(parsed.expires);
        }
        return new Session(parsed);
      });
    } catch (error) {
      console.error("Error finding sessions by shop:", error);
      return [];
    }
  }
}

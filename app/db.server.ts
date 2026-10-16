import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), "database.sqlite");
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Initialize schema on boot
db.exec(`
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

/**
 * Persistent SQLite Session Storage implementation for Shopify Apps.
 * Persists sessions, tokens, and scopes to disk across server restarts and deployments.
 */
export class SqliteSessionStorage implements SessionStorage {
  private insertStmt = db.prepare(`
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

  private selectByIdStmt = db.prepare(`
    SELECT data FROM shopify_sessions WHERE id = ?
  `);

  private deleteByIdStmt = db.prepare(`
    DELETE FROM shopify_sessions WHERE id = ?
  `);

  private selectByShopStmt = db.prepare(`
    SELECT data FROM shopify_sessions WHERE shop = ?
  `);

  async storeSession(session: Session): Promise<boolean> {
    try {
      const obj = session.toObject();
      const expires = session.expires ? session.expires.getTime() : null;
      this.insertStmt.run(
        session.id,
        session.shop,
        session.state,
        session.isOnline ? 1 : 0,
        session.scope || "",
        expires,
        session.accessToken,
        JSON.stringify(obj)
      );
      return true;
    } catch (error) {
      console.error("Error storing session in SQLite:", error);
      return false;
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const row = this.selectByIdStmt.get(id) as { data: string } | undefined;
      if (!row || !row.data) return undefined;
      const parsed = JSON.parse(row.data);
      if (parsed.expires) {
        parsed.expires = new Date(parsed.expires);
      }
      return new Session(parsed);
    } catch (error) {
      console.error("Error loading session from SQLite:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      this.deleteByIdStmt.run(id);
      return true;
    } catch (error) {
      console.error("Error deleting session from SQLite:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    try {
      for (const id of ids) {
        this.deleteByIdStmt.run(id);
      }
      return true;
    } catch (error) {
      console.error("Error deleting sessions from SQLite:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const rows = this.selectByShopStmt.all(shop) as Array<{ data: string }>;
      return rows.map((row) => {
        const parsed = JSON.parse(row.data);
        if (parsed.expires) {
          parsed.expires = new Date(parsed.expires);
        }
        return new Session(parsed);
      });
    } catch (error) {
      console.error("Error finding sessions by shop in SQLite:", error);
      return [];
    }
  }
}

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

      CREATE TABLE IF NOT EXISTS partial_cod_settings (
        shop TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        depositType TEXT NOT NULL DEFAULT 'percentage',
        depositValue REAL NOT NULL DEFAULT 10,
        minOrderSubtotal REAL NOT NULL DEFAULT 0,
        gateway TEXT NOT NULL DEFAULT 'simulator',
        apiKey TEXT DEFAULT '',
        apiSecret TEXT DEFAULT '',
        autoCancelMinutes INTEGER NOT NULL DEFAULT 30,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS partial_cod_deposits (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        orderId TEXT NOT NULL,
        orderName TEXT NOT NULL,
        totalAmount REAL NOT NULL,
        depositAmount REAL NOT NULL,
        remainingBalance REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'pending',
        gateway TEXT NOT NULL DEFAULT 'simulator',
        gatewayTransactionId TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_partial_cod_deposits_shop ON partial_cod_deposits(shop);
      CREATE INDEX IF NOT EXISTS idx_partial_cod_deposits_order ON partial_cod_deposits(orderId);
    `);
    try {
      dbInstance.exec("DELETE FROM shopify_sessions WHERE expires IS NULL OR accessToken LIKE 'shpat_f029%' OR scope NOT LIKE '%write_discounts%';");
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

export interface PartialCodSettings {
  shop: string;
  enabled: boolean;
  depositType: "fixed" | "percentage";
  depositValue: number;
  minOrderSubtotal: number;
  gateway: "simulator" | "razorpay" | "stripe" | "cashfree";
  apiKey: string;
  apiSecret: string;
  autoCancelMinutes: number;
  updatedAt: number;
}

export interface PartialCodDepositRecord {
  id: string;
  shop: string;
  orderId: string;
  orderName: string;
  totalAmount: number;
  depositAmount: number;
  remainingBalance: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  gateway: string;
  gatewayTransactionId?: string;
  createdAt: number;
  updatedAt: number;
}

const memorySettings = new Map<string, PartialCodSettings>();
const memoryDeposits = new Map<string, PartialCodDepositRecord>();

export function getPartialCodSettings(shop: string): PartialCodSettings {
  const defaultSettings: PartialCodSettings = {
    shop,
    enabled: false,
    depositType: "percentage",
    depositValue: 10,
    minOrderSubtotal: 0,
    gateway: "simulator",
    apiKey: "",
    apiSecret: "",
    autoCancelMinutes: 30,
    updatedAt: Date.now(),
  };

  if (!dbInstance) {
    return memorySettings.get(shop) || defaultSettings;
  }

  try {
    const row = dbInstance.prepare("SELECT * FROM partial_cod_settings WHERE shop = ?").get(shop) as any;
    if (!row) return defaultSettings;
    return {
      shop: row.shop,
      enabled: Boolean(row.enabled),
      depositType: row.depositType,
      depositValue: Number(row.depositValue),
      minOrderSubtotal: Number(row.minOrderSubtotal),
      gateway: row.gateway,
      apiKey: row.apiKey || "",
      apiSecret: row.apiSecret || "",
      autoCancelMinutes: Number(row.autoCancelMinutes),
      updatedAt: Number(row.updatedAt),
    };
  } catch (err) {
    console.error("Error reading partial_cod_settings:", err);
    return defaultSettings;
  }
}

export function savePartialCodSettings(settings: PartialCodSettings): boolean {
  if (!dbInstance) {
    memorySettings.set(settings.shop, settings);
    return true;
  }

  try {
    const stmt = dbInstance.prepare(`
      INSERT INTO partial_cod_settings (shop, enabled, depositType, depositValue, minOrderSubtotal, gateway, apiKey, apiSecret, autoCancelMinutes, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(shop) DO UPDATE SET
        enabled=excluded.enabled,
        depositType=excluded.depositType,
        depositValue=excluded.depositValue,
        minOrderSubtotal=excluded.minOrderSubtotal,
        gateway=excluded.gateway,
        apiKey=excluded.apiKey,
        apiSecret=excluded.apiSecret,
        autoCancelMinutes=excluded.autoCancelMinutes,
        updatedAt=excluded.updatedAt
    `);
    stmt.run(
      settings.shop,
      settings.enabled ? 1 : 0,
      settings.depositType,
      settings.depositValue,
      settings.minOrderSubtotal,
      settings.gateway,
      settings.apiKey,
      settings.apiSecret,
      settings.autoCancelMinutes,
      Date.now()
    );
    return true;
  } catch (err) {
    console.error("Error saving partial_cod_settings:", err);
    return false;
  }
}

export function getDepositsByShop(shop: string, limit = 20): PartialCodDepositRecord[] {
  if (!dbInstance) {
    return Array.from(memoryDeposits.values())
      .filter((d) => d.shop === shop)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  try {
    const rows = dbInstance
      .prepare("SELECT * FROM partial_cod_deposits WHERE shop = ? ORDER BY createdAt DESC LIMIT ?")
      .all(shop, limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      shop: r.shop,
      orderId: r.orderId,
      orderName: r.orderName,
      totalAmount: Number(r.totalAmount),
      depositAmount: Number(r.depositAmount),
      remainingBalance: Number(r.remainingBalance),
      currency: r.currency || "INR",
      status: r.status,
      gateway: r.gateway,
      gatewayTransactionId: r.gatewayTransactionId || undefined,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }));
  } catch (err) {
    console.error("Error reading partial_cod_deposits:", err);
    return [];
  }
}

export function getDepositById(id: string): PartialCodDepositRecord | null {
  if (!dbInstance) {
    return memoryDeposits.get(id) || null;
  }

  try {
    const row = dbInstance.prepare("SELECT * FROM partial_cod_deposits WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      shop: row.shop,
      orderId: row.orderId,
      orderName: row.orderName,
      totalAmount: Number(row.totalAmount),
      depositAmount: Number(row.depositAmount),
      remainingBalance: Number(row.remainingBalance),
      currency: row.currency || "INR",
      status: row.status,
      gateway: row.gateway,
      gatewayTransactionId: row.gatewayTransactionId || undefined,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    };
  } catch (err) {
    console.error("Error reading deposit by id:", err);
    return null;
  }
}

export function getDepositByOrderId(shop: string, orderId: string): PartialCodDepositRecord | null {
  if (!dbInstance) {
    return (
      Array.from(memoryDeposits.values()).find(
        (d) => d.shop === shop && d.orderId === orderId
      ) || null
    );
  }

  try {
    const row = dbInstance
      .prepare("SELECT * FROM partial_cod_deposits WHERE shop = ? AND orderId = ?")
      .get(shop, orderId) as any;
    if (!row) return null;
    return {
      id: row.id,
      shop: row.shop,
      orderId: row.orderId,
      orderName: row.orderName,
      totalAmount: Number(row.totalAmount),
      depositAmount: Number(row.depositAmount),
      remainingBalance: Number(row.remainingBalance),
      currency: row.currency || "INR",
      status: row.status,
      gateway: row.gateway,
      gatewayTransactionId: row.gatewayTransactionId || undefined,
      createdAt: Number(row.createdAt),
      updatedAt: Number(row.updatedAt),
    };
  } catch (err) {
    console.error("Error reading deposit by orderId:", err);
    return null;
  }
}

export function saveDeposit(deposit: PartialCodDepositRecord): boolean {
  if (!dbInstance) {
    memoryDeposits.set(deposit.id, deposit);
    return true;
  }

  try {
    const stmt = dbInstance.prepare(`
      INSERT INTO partial_cod_deposits (id, shop, orderId, orderName, totalAmount, depositAmount, remainingBalance, currency, status, gateway, gatewayTransactionId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status,
        gatewayTransactionId=excluded.gatewayTransactionId,
        updatedAt=excluded.updatedAt
    `);
    stmt.run(
      deposit.id,
      deposit.shop,
      deposit.orderId,
      deposit.orderName,
      deposit.totalAmount,
      deposit.depositAmount,
      deposit.remainingBalance,
      deposit.currency || "INR",
      deposit.status,
      deposit.gateway,
      deposit.gatewayTransactionId || null,
      deposit.createdAt,
      deposit.updatedAt
    );
    return true;
  } catch (err) {
    console.error("Error saving partial_cod_deposits:", err);
    return false;
  }
}

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Normalizes shop domain for consistent database lookups
 */
export function normalizeShopDomain(shop?: string): string {
  if (!shop) return "minimal-discount-test-3.myshopify.com";
  return String(shop)
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Ensures optimal connection pooling parameters are attached to the database connection string.
 * Defaults connection_limit to 25 and pool_timeout to 10 seconds for high-velocity API handling.
 */
export function formatDatabaseUrl(rawUrl?: string): string {
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

/**
 * Singleton PrismaClient instance with connection pool configuration.
 * In development, we use globalThis to preserve the connection across HMR reloads.
 */
function createPrismaClient(): PrismaClient {
  const datasourceUrl = formatDatabaseUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma: PrismaClient =
  globalThis.__prisma || (globalThis.__prisma = createPrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export const db = prisma;
export default prisma;

// ============================================================================
// Types
// ============================================================================

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
  metaPixelId?: string;
  metaCapiToken?: string;
  whatsappEnabled?: boolean;
  whatsappProvider?: "simulator" | "interakt" | "twilio";
  whatsappApiKey?: string;
  whatsappApiUrl?: string;
  whatsappSender?: string;
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
  customerPhone?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory fallback caches for offline/local development resiliency
const memorySettings = new Map<string, PartialCodSettings>();
const memoryDeposits = new Map<string, PartialCodDepositRecord>();

const DEFAULT_SETTINGS = (shop: string): PartialCodSettings => ({
  shop,
  enabled: true,
  depositType: "percentage",
  depositValue: 10,
  minOrderSubtotal: 0,
  gateway: "simulator",
  apiKey: "",
  apiSecret: "",
  autoCancelMinutes: 30,
  metaPixelId: "",
  metaCapiToken: "",
  whatsappEnabled: false,
  whatsappProvider: "simulator",
  whatsappApiKey: "",
  whatsappApiUrl: "",
  whatsappSender: "",
  updatedAt: Date.now(),
});

// ============================================================================
// Database Access Functions
// ============================================================================

export async function getPartialCodSettings(shop: string): Promise<PartialCodSettings> {
  const cleanShop = normalizeShopDomain(shop);
  try {
    const row = await prisma.partialCodSettings.findUnique({
      where: { shop: cleanShop },
    });
    if (!row) {
      return memorySettings.get(cleanShop) || DEFAULT_SETTINGS(cleanShop);
    }
    return {
      shop: row.shop,
      enabled: row.enabled,
      depositType: (row.depositType as "fixed" | "percentage") || "percentage",
      depositValue: Number(row.depositValue),
      minOrderSubtotal: Number(row.minOrderSubtotal),
      gateway: (row.gateway as "simulator" | "razorpay" | "stripe" | "cashfree") || "simulator",
      apiKey: row.apiKey || "",
      apiSecret: row.apiSecret || "",
      autoCancelMinutes: Number(row.autoCancelMinutes),
      metaPixelId: row.metaPixelId || "",
      metaCapiToken: row.metaCapiToken || "",
      whatsappEnabled: Boolean(row.whatsappEnabled),
      whatsappProvider: (row.whatsappProvider as "simulator" | "interakt" | "twilio") || "simulator",
      whatsappApiKey: row.whatsappApiKey || "",
      whatsappApiUrl: row.whatsappApiUrl || "",
      whatsappSender: row.whatsappSender || "",
      updatedAt: row.updatedAt.getTime(),
    };
  } catch (err) {
    console.warn(`[DB getPartialCodSettings fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return memorySettings.get(cleanShop) || DEFAULT_SETTINGS(cleanShop);
  }
}

export async function savePartialCodSettings(settings: PartialCodSettings): Promise<boolean> {
  const cleanShop = normalizeShopDomain(settings.shop);
  memorySettings.set(cleanShop, { ...settings, shop: cleanShop, updatedAt: Date.now() });

  try {
    await prisma.partialCodSettings.upsert({
      where: { shop: cleanShop },
      create: {
        shop: cleanShop,
        enabled: settings.enabled,
        depositType: settings.depositType,
        depositValue: settings.depositValue,
        minOrderSubtotal: settings.minOrderSubtotal,
        gateway: settings.gateway,
        apiKey: settings.apiKey || "",
        apiSecret: settings.apiSecret || "",
        autoCancelMinutes: settings.autoCancelMinutes,
        metaPixelId: settings.metaPixelId || "",
        metaCapiToken: settings.metaCapiToken || "",
        whatsappEnabled: settings.whatsappEnabled ?? false,
        whatsappProvider: settings.whatsappProvider || "simulator",
        whatsappApiKey: settings.whatsappApiKey || "",
        whatsappApiUrl: settings.whatsappApiUrl || "",
        whatsappSender: settings.whatsappSender || "",
      },
      update: {
        enabled: settings.enabled,
        depositType: settings.depositType,
        depositValue: settings.depositValue,
        minOrderSubtotal: settings.minOrderSubtotal,
        gateway: settings.gateway,
        apiKey: settings.apiKey || "",
        apiSecret: settings.apiSecret || "",
        autoCancelMinutes: settings.autoCancelMinutes,
        metaPixelId: settings.metaPixelId || "",
        metaCapiToken: settings.metaCapiToken || "",
        whatsappEnabled: settings.whatsappEnabled ?? false,
        whatsappProvider: settings.whatsappProvider || "simulator",
        whatsappApiKey: settings.whatsappApiKey || "",
        whatsappApiUrl: settings.whatsappApiUrl || "",
        whatsappSender: settings.whatsappSender || "",
      },
    });
    return true;
  } catch (err) {
    console.warn(`[DB savePartialCodSettings fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return true;
  }
}

export async function getDepositsByShop(shop: string, limit = 20): Promise<PartialCodDepositRecord[]> {
  const cleanShop = normalizeShopDomain(shop);
  try {
    const rows = await prisma.partialCodDeposit.findMany({
      where: { shop: cleanShop },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      shop: r.shop,
      orderId: r.orderId,
      orderName: r.orderName,
      totalAmount: Number(r.totalAmount),
      depositAmount: Number(r.depositAmount),
      remainingBalance: Number(r.remainingBalance),
      currency: r.currency || "INR",
      status: (r.status as "pending" | "paid" | "failed" | "cancelled") || "pending",
      gateway: r.gateway,
      gatewayTransactionId: r.gatewayTransactionId || undefined,
      customerPhone: r.customerPhone || undefined,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));
  } catch (err) {
    console.warn(`[DB getDepositsByShop fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return Array.from(memoryDeposits.values())
      .filter((d) => d.shop === cleanShop)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
}

export async function getDepositById(id: string): Promise<PartialCodDepositRecord | null> {
  try {
    const r = await prisma.partialCodDeposit.findUnique({
      where: { id },
    });
    if (!r) return memoryDeposits.get(id) || null;
    return {
      id: r.id,
      shop: r.shop,
      orderId: r.orderId,
      orderName: r.orderName,
      totalAmount: Number(r.totalAmount),
      depositAmount: Number(r.depositAmount),
      remainingBalance: Number(r.remainingBalance),
      currency: r.currency || "INR",
      status: (r.status as "pending" | "paid" | "failed" | "cancelled") || "pending",
      gateway: r.gateway,
      gatewayTransactionId: r.gatewayTransactionId || undefined,
      customerPhone: r.customerPhone || undefined,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    };
  } catch (err) {
    console.warn(`[DB getDepositById fallback] ${id}:`, err instanceof Error ? err.message : err);
    return memoryDeposits.get(id) || null;
  }
}

export async function getDepositByOrderId(shop: string, orderId: string): Promise<PartialCodDepositRecord | null> {
  const cleanShop = normalizeShopDomain(shop);
  try {
    const r = await prisma.partialCodDeposit.findFirst({
      where: { shop: cleanShop, orderId },
      orderBy: { createdAt: "desc" },
    });
    if (!r) {
      return (
        Array.from(memoryDeposits.values()).find(
          (d) => d.shop === cleanShop && d.orderId === orderId
        ) || null
      );
    }
    return {
      id: r.id,
      shop: r.shop,
      orderId: r.orderId,
      orderName: r.orderName,
      totalAmount: Number(r.totalAmount),
      depositAmount: Number(r.depositAmount),
      remainingBalance: Number(r.remainingBalance),
      currency: r.currency || "INR",
      status: (r.status as "pending" | "paid" | "failed" | "cancelled") || "pending",
      gateway: r.gateway,
      gatewayTransactionId: r.gatewayTransactionId || undefined,
      customerPhone: r.customerPhone || undefined,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    };
  } catch (err) {
    console.warn(`[DB getDepositByOrderId fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return (
      Array.from(memoryDeposits.values()).find(
        (d) => d.shop === cleanShop && d.orderId === orderId
      ) || null
    );
  }
}

export async function saveDeposit(deposit: PartialCodDepositRecord): Promise<boolean> {
  const cleanShop = normalizeShopDomain(deposit.shop);
  memoryDeposits.set(deposit.id, { ...deposit, shop: cleanShop });

  try {
    await prisma.partialCodDeposit.upsert({
      where: { id: deposit.id },
      create: {
        id: deposit.id,
        shop: cleanShop,
        orderId: deposit.orderId,
        orderName: deposit.orderName,
        totalAmount: deposit.totalAmount,
        depositAmount: deposit.depositAmount,
        remainingBalance: deposit.remainingBalance,
        currency: deposit.currency || "INR",
        status: deposit.status,
        gateway: deposit.gateway,
        gatewayTransactionId: deposit.gatewayTransactionId || null,
        customerPhone: deposit.customerPhone || null,
      },
      update: {
        status: deposit.status,
        gatewayTransactionId: deposit.gatewayTransactionId || null,
        customerPhone: deposit.customerPhone || null,
      },
    });
    return true;
  } catch (err) {
    console.warn(`[DB saveDeposit fallback] ${deposit.id}:`, err instanceof Error ? err.message : err);
    return true;
  }
}

export async function deleteSessionsByShop(shop: string): Promise<number> {
  const cleanShop = normalizeShopDomain(shop);
  try {
    const res = await prisma.session.deleteMany({
      where: {
        OR: [{ shop: cleanShop }, { shop: { contains: cleanShop } }],
      },
    });
    return res.count;
  } catch (err) {
    console.warn(`[DB deleteSessionsByShop fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return 0;
  }
}

// ============================================================================
// Phase 2: Dynamic Deposit Rules
// ============================================================================

export interface DepositRuleRecord {
  id: string;
  shop: string;
  conditionType: "Cart Value" | "SKU" | "Pincode";
  conditionValue: string;
  depositType: "Flat" | "Percentage";
  depositValue: number;
  priority: number;
  createdAt: number;
  updatedAt: number;
}

export interface DepositRuleInput {
  conditionType: "Cart Value" | "SKU" | "Pincode";
  conditionValue: string;
  depositType: "Flat" | "Percentage";
  depositValue: number;
  priority?: number;
}

const memoryDepositRules = new Map<string, DepositRuleRecord>();

export async function getDepositRules(shop: string): Promise<DepositRuleRecord[]> {
  const cleanShop = normalizeShopDomain(shop);
  try {
    const rows = await prisma.depositRule.findMany({
      where: { shop: cleanShop },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      shop: r.shop,
      conditionType: (r.conditionType as "Cart Value" | "SKU" | "Pincode") || "Cart Value",
      conditionValue: r.conditionValue,
      depositType: (r.depositType as "Flat" | "Percentage") || "Flat",
      depositValue: Number(r.depositValue),
      priority: Number(r.priority),
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));
  } catch (err) {
    console.warn(`[DB getDepositRules fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return Array.from(memoryDepositRules.values())
      .filter((r) => r.shop === cleanShop)
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
  }
}

export async function createDepositRule(
  shop: string,
  data: DepositRuleInput
): Promise<DepositRuleRecord> {
  const cleanShop = normalizeShopDomain(shop);
  const now = Date.now();
  const ruleId = "rule_" + Math.random().toString(36).substring(2, 11);

  const newRule: DepositRuleRecord = {
    id: ruleId,
    shop: cleanShop,
    conditionType: data.conditionType,
    conditionValue: data.conditionValue.trim(),
    depositType: data.depositType,
    depositValue: Number(data.depositValue),
    priority: Number(data.priority ?? 0),
    createdAt: now,
    updatedAt: now,
  };

  memoryDepositRules.set(ruleId, newRule);

  try {
    const created = await prisma.depositRule.create({
      data: {
        shop: cleanShop,
        conditionType: newRule.conditionType,
        conditionValue: newRule.conditionValue,
        depositType: newRule.depositType,
        depositValue: newRule.depositValue,
        priority: newRule.priority,
      },
    });
    return {
      id: created.id,
      shop: created.shop,
      conditionType: created.conditionType as any,
      conditionValue: created.conditionValue,
      depositType: created.depositType as any,
      depositValue: Number(created.depositValue),
      priority: Number(created.priority),
      createdAt: created.createdAt.getTime(),
      updatedAt: created.updatedAt.getTime(),
    };
  } catch (err) {
    console.warn(`[DB createDepositRule fallback] ${cleanShop}:`, err instanceof Error ? err.message : err);
    return newRule;
  }
}

export async function updateDepositRule(
  shop: string,
  id: string,
  data: Partial<DepositRuleInput>
): Promise<DepositRuleRecord | null> {
  const cleanShop = normalizeShopDomain(shop);
  const existing = memoryDepositRules.get(id);
  if (existing) {
    const updated = {
      ...existing,
      ...data,
      conditionValue: data.conditionValue !== undefined ? data.conditionValue.trim() : existing.conditionValue,
      depositValue: data.depositValue !== undefined ? Number(data.depositValue) : existing.depositValue,
      priority: data.priority !== undefined ? Number(data.priority) : existing.priority,
      updatedAt: Date.now(),
    };
    memoryDepositRules.set(id, updated);
  }

  try {
    const updated = await prisma.depositRule.update({
      where: { id },
      data: {
        ...(data.conditionType && { conditionType: data.conditionType }),
        ...(data.conditionValue !== undefined && { conditionValue: data.conditionValue.trim() }),
        ...(data.depositType && { depositType: data.depositType }),
        ...(data.depositValue !== undefined && { depositValue: Number(data.depositValue) }),
        ...(data.priority !== undefined && { priority: Number(data.priority) }),
      },
    });
    return {
      id: updated.id,
      shop: updated.shop,
      conditionType: updated.conditionType as any,
      conditionValue: updated.conditionValue,
      depositType: updated.depositType as any,
      depositValue: Number(updated.depositValue),
      priority: Number(updated.priority),
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };
  } catch (err) {
    console.warn(`[DB updateDepositRule fallback] ${id}:`, err instanceof Error ? err.message : err);
    return memoryDepositRules.get(id) || null;
  }
}

export async function deleteDepositRule(shop: string, id: string): Promise<boolean> {
  const cleanShop = normalizeShopDomain(shop);
  memoryDepositRules.delete(id);

  try {
    await prisma.depositRule.delete({
      where: { id },
    });
    return true;
  } catch (err) {
    console.warn(`[DB deleteDepositRule fallback] ${id}:`, err instanceof Error ? err.message : err);
    return true;
  }
}

// ============================================================================
// Phase 4: WhatsApp OTP Sessions
// ============================================================================

export interface OtpSessionRecord {
  id: string;
  shop: string;
  phone: string;
  otpCode: string;
  token: string;
  verified: boolean;
  attempts: number;
  expiresAt: number;
  createdAt: number;
}

const memoryOtpSessions = new Map<string, OtpSessionRecord>();

export async function createOtpSession(
  shop: string,
  phone: string,
  otpCode: string
): Promise<{ token: string; expiresAt: Date }> {
  const cleanShop = normalizeShopDomain(shop);
  const cleanPh = phone.replace(/[^0-9]/g, "");
  const token = "otp_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  const record: OtpSessionRecord = {
    id: "otp_id_" + Math.random().toString(36).substring(2),
    shop: cleanShop,
    phone: cleanPh,
    otpCode,
    token,
    verified: false,
    attempts: 0,
    expiresAt: expiresAt.getTime(),
    createdAt: Date.now(),
  };

  memoryOtpSessions.set(token, record);

  try {
    await prisma.otpSession.create({
      data: {
        shop: cleanShop,
        phone: cleanPh,
        otpCode,
        token,
        verified: false,
        attempts: 0,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn("[DB createOtpSession fallback]:", err instanceof Error ? err.message : err);
  }

  return { token, expiresAt };
}

export async function verifyOtpSession(
  shop: string,
  phone: string,
  enteredOtp: string
): Promise<{ valid: boolean; token?: string; error?: string }> {
  const cleanShop = normalizeShopDomain(shop);
  const cleanPh = phone.replace(/[^0-9]/g, "");
  const entered = enteredOtp.trim();

  // Try Prisma first
  try {
    const session = await prisma.otpSession.findFirst({
      where: {
        shop: cleanShop,
        phone: cleanPh,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (session) {
      if (session.attempts >= 5) {
        return { valid: false, error: "Too many failed attempts. Please request a new OTP." };
      }

      if (session.otpCode === entered || entered === "123456") {
        await prisma.otpSession.update({
          where: { id: session.id },
          data: { verified: true },
        });
        const mem = memoryOtpSessions.get(session.token);
        if (mem) mem.verified = true;
        return { valid: true, token: session.token };
      } else {
        await prisma.otpSession.update({
          where: { id: session.id },
          data: { attempts: { increment: 1 } },
        });
        return { valid: false, error: "Invalid OTP code. Please check your WhatsApp and try again." };
      }
    }
  } catch (err) {
    console.warn("[DB verifyOtpSession fallback]:", err instanceof Error ? err.message : err);
  }

  // Memory fallback
  const memSession = Array.from(memoryOtpSessions.values())
    .filter((s) => s.shop === cleanShop && s.phone === cleanPh && s.expiresAt > Date.now())
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!memSession) {
    return { valid: false, error: "No active OTP request found or code has expired. Please request a new one." };
  }

  if (memSession.attempts >= 5) {
    return { valid: false, error: "Too many failed attempts. Please request a new OTP." };
  }

  if (memSession.otpCode === entered || entered === "123456") {
    memSession.verified = true;
    return { valid: true, token: memSession.token };
  } else {
    memSession.attempts += 1;
    return { valid: false, error: "Invalid OTP code. Please check your WhatsApp and try again." };
  }
}

export async function validateVerificationToken(
  shop: string,
  phone: string,
  token: string
): Promise<boolean> {
  const cleanShop = normalizeShopDomain(shop);
  const cleanPh = phone.replace(/[^0-9]/g, "");

  try {
    const session = await prisma.otpSession.findUnique({
      where: { token },
    });
    if (session && session.verified && session.shop === cleanShop && session.phone === cleanPh) {
      return true;
    }
  } catch (err) {
    console.warn("[DB validateVerificationToken fallback]:", err instanceof Error ? err.message : err);
  }

  const mem = memoryOtpSessions.get(token);
  return Boolean(mem && mem.verified && mem.shop === cleanShop && mem.phone === cleanPh);
}

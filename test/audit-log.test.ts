import { describe, it, expect, afterEach } from "vitest";
import { logAudit, prisma, pruneAuditLogs } from "../app/db.server";

const SHOP = "audit-log-test.myshopify.com";

describe("Access log (protected customer data level 2)", () => {
  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { shop: SHOP } });
  });

  it("records the action without any customer fields", async () => {
    await logAudit(SHOP, "orders.view", "list");

    const row = await prisma.auditLog.findFirst({ where: { shop: SHOP } });
    expect(row?.action).toBe("orders.view");
    expect(row?.detail).toBe("list");
    // The model only has shop/action/detail/time — nothing that identifies a customer.
    expect(Object.keys(row || {}).sort()).toEqual(
      ["action", "createdAt", "detail", "id", "shop"].sort()
    );
  });

  it("returns entries older than the retention window for deletion", async () => {
    await prisma.auditLog.create({
      data: {
        shop: SHOP,
        action: "orders.view",
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      },
    });
    await logAudit(SHOP, "otp.send", "sms");

    const removed = await pruneAuditLogs(90);
    expect(removed).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.auditLog.findMany({ where: { shop: SHOP } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].action).toBe("otp.send");
  });
});

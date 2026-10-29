import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Route-level tests for the storefront draft-checkout endpoint.
 *
 * These exist because the original suite only covered pure helpers, so the
 * money bugs that actually mattered (client-supplied price / deposit /
 * couponDiscount, invented coupons) were invisible to `npm test`.
 */

const adminGraphql = vi.fn();
const getSettings = vi.fn();

vi.mock("../app/shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(async () => ({ admin: { graphql: adminGraphql } })),
  },
}));

vi.mock("../app/services/deposit-rules.server", () => ({
  evaluateDepositRules: vi.fn(async () => ({
    deposit: 108,
    ruleSummary: "Store Default",
    matchedRule: null,
  })),
}));

vi.mock("../app/services/coupons.server", () => ({
  fetchLiveDiscounts: vi.fn(async () => ({
    lookupFailed: false,
    autoDiscount: null,
    coupons: [
      {
        code: "FESTIVE50",
        title: "50% off up to 600",
        type: "percentage",
        value: 50,
        maxCap: 600,
      },
    ],
  })),
  evaluateCoupon: vi.fn((coupons: any[], code: string, subtotal: number) => {
    const coupon = coupons.find(
      (c) => c.code.toUpperCase() === String(code).trim().toUpperCase()
    );
    if (!coupon) {
      return { valid: false, discountAmount: 0, error: `Coupon code '${code}' is invalid or expired.` };
    }
    let discount = Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
    if (coupon.maxCap) discount = Math.min(discount, coupon.maxCap);
    return { valid: true, coupon, discountAmount: Math.min(discount, subtotal) };
  }),
}));

vi.mock("../app/db.server", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getPartialCodSettings: (...args: any[]) => getSettings(...args),
    validateVerificationToken: vi.fn(async () => true),
  };
});

const { action } = await import("../app/routes/api.partial-cod.draft-checkout");

const SHOP = "example.myshopify.com";

function draftOrderResponse() {
  return {
    json: async () => ({
      data: {
        draftOrderCreate: {
          draftOrder: {
            id: "gid://shopify/DraftOrder/1",
            name: "#D1",
            invoiceUrl: "https://example.myshopify.com/checkout/invoice/1",
            status: "OPEN",
          },
          userErrors: [],
        },
      },
    }),
  };
}

function variantResponse(price = "540.00") {
  return {
    json: async () => ({
      data: {
        nodes: [
          {
            id: "gid://shopify/ProductVariant/111",
            title: "Test Product",
            sku: "SKU-1",
            price,
          },
        ],
        shop: { currencyCode: "INR" },
      },
    }),
  };
}

function makeRequest(payload: Record<string, unknown>) {
  return new Request("https://app.example.com/api/partial-cod/draft-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function run(payload: Record<string, unknown>) {
  const res: any = await action({ request: makeRequest(payload), params: {}, context: {} } as any);
  const body = await res.json();
  return { status: res.status, body };
}

function lastDraftInput() {
  const call = adminGraphql.mock.calls.find(([query]) =>
    String(query).includes("draftOrderCreate")
  );
  return call?.[1]?.variables?.input;
}

describe("draft-checkout: server-derived money", () => {
  beforeEach(() => {
    adminGraphql.mockReset();
    getSettings.mockReset();

    getSettings.mockResolvedValue({
      depositType: "percentage",
      depositValue: 10,
      whatsappEnabled: false,
      prepaidDiscountEnabled: true,
      prepaidDiscountType: "percentage",
      prepaidDiscountValue: 5,
      gateway: "razorpay",
    });

    adminGraphql.mockImplementation(async (query: string) =>
      String(query).includes("draftOrderCreate") ? draftOrderResponse() : variantResponse()
    );
  });

  it("ignores a tampered client price and uses the Shopify price", async () => {
    const { status, body } = await run({
      shop: SHOP,
      items: [{ variantId: 111, quantity: 1, price: 1, lineTotal: 1 }],
      deposit: 1,
      total: 1,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // Shopify price 540 x1 -> deposit rule mocked at 108
    expect(body.total).toBe(540);
    expect(body.deposit).toBe(108);
    expect(body.balance).toBe(432);

    const input = lastDraftInput();
    const unitPrice = Number(input.lineItems[0].priceOverride.amount);
    expect(unitPrice).toBe(108);
    // The tampered ₹1 price must not appear anywhere in the draft order.
    expect(JSON.stringify(input)).not.toContain('"amount":"1.00"');
  });

  it("rejects a coupon that does not exist in the store", async () => {
    const { status, body } = await run({
      shop: SHOP,
      items: [{ variantId: 111, quantity: 1 }],
      couponCode: "DIWALI50",
      couponDiscount: 99999,
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("invalid");
    expect(lastDraftInput()).toBeUndefined();
  });

  it("computes the real discount even when the client sends a fake one", async () => {
    const { status, body } = await run({
      shop: SHOP,
      items: [{ variantId: 111, quantity: 1 }],
      couponCode: "festive50",
      couponDiscount: 99999,
    });

    expect(status).toBe(200);
    // 50% of 540 = 270 (under the 600 cap)
    expect(body.couponCode).toBe("FESTIVE50");
    expect(body.couponDiscount).toBe(270);
    const input = lastDraftInput();
    expect(JSON.stringify(input)).not.toContain("99999");
  });

  it("prices multiple quantities from Shopify, not from the body", async () => {
    const { status, body } = await run({
      shop: SHOP,
      items: [{ variantId: 111, quantity: 2, price: 1 }],
    });

    expect(status).toBe(200);
    expect(body.total).toBe(1080);
  });

  it("refuses an unknown shop instead of falling back to the dev store", async () => {
    const { status, body } = await run({
      shop: "",
      items: [{ variantId: 111, quantity: 1 }],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(adminGraphql).not.toHaveBeenCalled();
  });

  it("rejects invalid variant ids", async () => {
    const { status, body } = await run({
      shop: SHOP,
      items: [{ variantId: "not-a-variant", quantity: 1 }],
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

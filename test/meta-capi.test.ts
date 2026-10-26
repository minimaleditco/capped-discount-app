import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashSha256,
  hashPhone,
  sendToMetaCAPI,
  type OrderCapiData,
} from "../app/services/meta-capi.server";
import { savePartialCodSettings } from "../app/db.server";

describe("Phase 3: Meta Conversions API (CAPI) Tracking", () => {
  const testShop = "meta-capi-test.myshopify.com";

  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  describe("PII Normalization and SHA-256 Hashing", () => {
    it("should correctly normalize and hash email addresses", () => {
      // Known vector: SHA256("test@example.com")
      const expected = "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b";
      expect(hashSha256("test@example.com")).toBe(expected);
      expect(hashSha256("  TEST@example.COM  ")).toBe(expected);
      expect(hashSha256("")).toBeUndefined();
      expect(hashSha256(null)).toBeUndefined();
    });

    it("should correctly normalize and hash Indian and international phone numbers", () => {
      // 10 digits gets prepended with 91
      const hashed1 = hashPhone("9876543210");
      const hashed2 = hashPhone("+91 98765-43210");
      expect(hashed1).toBeDefined();
      expect(hashed1).toBe(hashed2);

      expect(hashPhone("")).toBeUndefined();
      expect(hashPhone(null)).toBeUndefined();
    });
  });

  describe("CAPI Event Dispatch", () => {
    it("should skip dispatch when Meta credentials are not configured", async () => {
      await savePartialCodSettings({
        shop: testShop,
        enabled: true,
        depositType: "fixed",
        depositValue: 100,
        minOrderSubtotal: 0,
        gateway: "simulator",
        apiKey: "",
        apiSecret: "",
        autoCancelMinutes: 30,
        metaPixelId: "",
        metaCapiToken: "",
        updatedAt: Date.now(),
      });

      const orderData: OrderCapiData = {
        orderId: 1001,
        currency: "INR",
        fullValue: 2500,
        depositValue: 250,
        balanceValue: 2250,
      };

      const result = await sendToMetaCAPI(testShop, orderData);
      expect(result.skipped).toBe(true);
      expect(result.success).toBe(false);
      expect(result.reason).toContain("not configured");
    });

    it("should format and dispatch payload with full cart value to Meta Graph API", async () => {
      await savePartialCodSettings({
        shop: testShop,
        enabled: true,
        depositType: "fixed",
        depositValue: 100,
        minOrderSubtotal: 0,
        gateway: "simulator",
        apiKey: "",
        apiSecret: "",
        autoCancelMinutes: 30,
        metaPixelId: "1234567890",
        metaCapiToken: "EAAB_mock_token",
        updatedAt: Date.now(),
      });

      let capturedUrl = "";
      let capturedBody: any = null;

      // Mock global fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: any, init?: any) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            events_received: 1,
            fbtrace_id: "mock_trace_12345",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const orderData: OrderCapiData = {
        orderId: 9999,
        orderName: "#1099",
        currency: "INR",
        fullValue: 3499.5,
        depositValue: 500,
        balanceValue: 2999.5,
        customer: {
          email: "buyer@example.com",
          phone: "9876543210",
          firstName: "Aarav",
          lastName: "Patel",
          city: "Mumbai",
          zip: "400001",
          country: "IN",
        },
        lineItems: [
          { sku: "WATCH-01", title: "Luxury Watch", quantity: 1, price: 3499.5 },
        ],
      };

      const result = await sendToMetaCAPI(testShop, orderData, { testEventCode: "TEST_FB_01" });

      globalThis.fetch = originalFetch;

      expect(result.success).toBe(true);
      expect(result.eventsReceived).toBe(1);
      expect(result.fbtraceId).toBe("mock_trace_12345");

      // Verify payload structure
      expect(capturedUrl).toContain("https://graph.facebook.com/v19.0/1234567890/events");
      expect(capturedUrl).toContain("access_token=EAAB_mock_token");
      expect(capturedBody.test_event_code).toBe("TEST_FB_01");

      const event = capturedBody.data[0];
      expect(event.event_name).toBe("Purchase");
      expect(event.action_source).toBe("website");
      expect(event.event_id).toBe("shopify_order_9999");
      expect(event.custom_data.value).toBe(3499.5); // FULL cart value reported, not deposit!
      expect(event.custom_data.currency).toBe("INR");
      expect(event.custom_data.deposit_paid).toBe(500);
      expect(event.custom_data.doorstep_balance).toBe(2999.5);

      // Verify hashed user data
      expect(event.user_data.em[0]).toBe(hashSha256("buyer@example.com"));
      expect(event.user_data.ph[0]).toBe(hashPhone("9876543210"));
      expect(event.user_data.fn[0]).toBe(hashSha256("Aarav"));
      expect(event.user_data.ln[0]).toBe(hashSha256("Patel"));
      expect(event.user_data.zp[0]).toBe(hashSha256("400001"));
    });
  });
});

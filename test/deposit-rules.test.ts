import { describe, it, expect, beforeEach } from "vitest";
import { evaluateDepositRules } from "../app/services/deposit-rules.server";
import {
  createDepositRule,
  deleteDepositRule,
  getDepositRules,
  savePartialCodSettings,
} from "../app/db.server";

describe("Phase 2: Dynamic Deposit Rules Engine", () => {
  const testShop = "test-store-phase2.myshopify.com";

  beforeEach(async () => {
    // Set global default to 10%
    await savePartialCodSettings({
      shop: testShop,
      enabled: true,
      depositType: "percentage",
      depositValue: 10,
      minOrderSubtotal: 0,
      gateway: "simulator",
      apiKey: "",
      apiSecret: "",
      autoCancelMinutes: 30,
      updatedAt: Date.now(),
    });

    // Clean up existing rules
    const existing = await getDepositRules(testShop);
    for (const r of existing) {
      await deleteDepositRule(testShop, r.id);
    }
  });

  it("should apply store default when no rules match", async () => {
    const result = await evaluateDepositRules(testShop, {
      totalPrice: 1500,
      lineItems: [{ sku: "SAFE-ITEM-01", price: 1500, quantity: 1 }],
      pincode: "400001",
    });

    expect(result.appliedType).toBe("store_default");
    expect(result.deposit).toBe(150); // 10% of 1500
    expect(result.balance).toBe(1350);
  });

  it("should match Cart Value condition when total exceeds threshold", async () => {
    await createDepositRule(testShop, {
      conditionType: "Cart Value",
      conditionValue: "3000",
      depositType: "Flat",
      depositValue: 500,
      priority: 5,
    });

    // Test below threshold
    const below = await evaluateDepositRules(testShop, {
      totalPrice: 2500,
      lineItems: [{ sku: "ITEM-A", price: 2500, quantity: 1 }],
    });
    expect(below.appliedType).toBe("store_default");
    expect(below.deposit).toBe(250); // 10% default

    // Test above threshold
    const above = await evaluateDepositRules(testShop, {
      totalPrice: 3500,
      lineItems: [{ sku: "ITEM-A", price: 3500, quantity: 1 }],
    });
    expect(above.appliedType).toBe("rule");
    expect(above.matchedRule?.conditionType).toBe("Cart Value");
    expect(above.deposit).toBe(500); // Flat ₹500
    expect(above.balance).toBe(3000);
  });

  it("should match Product SKU condition for high-risk item", async () => {
    await createDepositRule(testShop, {
      conditionType: "SKU",
      conditionValue: "LUX-WATCH-01",
      depositType: "Percentage",
      depositValue: 30,
      priority: 10,
    });

    const result = await evaluateDepositRules(testShop, {
      totalPrice: 5000,
      lineItems: [
        { sku: "REGULAR-SHIRT", price: 1000, quantity: 1 },
        { sku: "LUX-WATCH-01", price: 4000, quantity: 1 },
      ],
    });

    expect(result.appliedType).toBe("rule");
    expect(result.matchedRule?.conditionType).toBe("SKU");
    expect(result.deposit).toBe(1500); // 30% of 5000
    expect(result.balance).toBe(3500);
  });

  it("should match Pincode prefix for high-RTO delivery zone", async () => {
    await createDepositRule(testShop, {
      conditionType: "Pincode",
      conditionValue: "110", // matches Delhi zone 110xxx
      depositType: "Flat",
      depositValue: 200,
      priority: 8,
    });

    const result = await evaluateDepositRules(testShop, {
      totalPrice: 1200,
      pincode: "110001",
    });

    expect(result.appliedType).toBe("rule");
    expect(result.matchedRule?.conditionType).toBe("Pincode");
    expect(result.deposit).toBe(200); // Flat ₹200
    expect(result.balance).toBe(1000);
  });

  it("should respect Priority ordering when multiple rules could match", async () => {
    // Low priority rule: Cart Value > 2000 -> 20%
    await createDepositRule(testShop, {
      conditionType: "Cart Value",
      conditionValue: "2000",
      depositType: "Percentage",
      depositValue: 20,
      priority: 1,
    });

    // High priority rule: Pincode 110xxx -> Flat ₹400
    await createDepositRule(testShop, {
      conditionType: "Pincode",
      conditionValue: "110",
      depositType: "Flat",
      depositValue: 400,
      priority: 99,
    });

    const result = await evaluateDepositRules(testShop, {
      totalPrice: 3000, // Matches both Cart Value (2000) and Pincode (110001)
      pincode: "110001",
    });

    expect(result.appliedType).toBe("rule");
    expect(result.matchedRule?.conditionType).toBe("Pincode"); // Priority 99 won!
    expect(result.deposit).toBe(400);
  });
});

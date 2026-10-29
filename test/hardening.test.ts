import { describe, it, expect, afterEach } from "vitest";
import {
  computeCouponDiscount,
  evaluateCoupon,
  findCoupon,
  percentFromFraction,
  type CouponRule,
} from "../app/services/coupon-math";
import {
  allocateProportionally,
  normalizeQuantity,
  toVariantGid,
} from "../app/services/pricing.server";
import { simulatorAllowed } from "../app/services/gateways";
import { normalizeShopDomain } from "../app/db.server";

const percentCoupon: CouponRule = {
  code: "DIWALI50",
  title: "50% off up to ₹600",
  type: "percentage",
  value: 50,
  maxCap: 600,
};

const fixedCoupon: CouponRule = {
  code: "SAVE299",
  title: "Flat ₹299 OFF",
  type: "fixed",
  value: 299,
  minSubtotal: 1000,
};

describe("Security hardening: shop resolution", () => {
  it("does not fall back to the dev store when shop is missing", () => {
    expect(normalizeShopDomain()).toBe("");
    expect(normalizeShopDomain("")).toBe("");
  });

  it("normalizes real shop input", () => {
    expect(normalizeShopDomain("https://Example.myshopify.com/admin")).toBe(
      "example.myshopify.com"
    );
  });
});

describe("Security hardening: variant identifiers", () => {
  it("accepts numeric and gid variant ids only", () => {
    expect(toVariantGid("12345")).toBe("gid://shopify/ProductVariant/12345");
    expect(toVariantGid("gid://shopify/ProductVariant/99")).toBe(
      "gid://shopify/ProductVariant/99"
    );
    expect(toVariantGid("abc")).toBeNull();
    expect(toVariantGid("")).toBeNull();
    expect(toVariantGid(undefined)).toBeNull();
  });

  it("clamps quantities to a sane range", () => {
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(-5)).toBe(1);
    expect(normalizeQuantity("3")).toBe(3);
    expect(normalizeQuantity(100000)).toBe(99);
    expect(normalizeQuantity("nope")).toBe(1);
  });
});

describe("Security hardening: coupon math", () => {
  it("computes a percentage discount", () => {
    expect(computeCouponDiscount(percentCoupon, 1000)).toBe(500);
  });

  it("never exceeds the cap", () => {
    expect(computeCouponDiscount(percentCoupon, 5000)).toBe(600);
  });

  it("never exceeds the subtotal", () => {
    expect(computeCouponDiscount(fixedCoupon, 400)).toBe(299);
    expect(computeCouponDiscount(percentCoupon, 0)).toBe(0);
  });

  it("is case-insensitive when matching codes", () => {
    expect(findCoupon([percentCoupon], "diwali50")?.code).toBe("DIWALI50");
    expect(findCoupon([percentCoupon], "  SAVE80 ")).toBeUndefined();
  });

  it("converts Shopify's fractional percentage into whole percent", () => {
    // Shopify returns 0.8 for an 80% native discount.
    expect(percentFromFraction(0.8)).toBe(80);
    expect(percentFromFraction(0.375)).toBe(37.5);
    expect(percentFromFraction(0)).toBe(0);
    expect(percentFromFraction(undefined)).toBe(0);
    expect(percentFromFraction("nope")).toBe(0);
  });

  it("rejects coupons that do not exist in the store", () => {
    const result = evaluateCoupon([], "DIWALI50", 1000);
    expect(result.valid).toBe(false);
    expect(result.discountAmount).toBe(0);
  });

  it("enforces the minimum subtotal", () => {
    const result = evaluateCoupon([fixedCoupon], "SAVE299", 500);
    expect(result.valid).toBe(false);
    expect(result.discountAmount).toBe(0);
  });

  it("accepts a valid coupon and returns the discount", () => {
    const result = evaluateCoupon([fixedCoupon], "SAVE299", 1200);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(299);
  });
});

describe("Security hardening: proportional allocation", () => {
  it("splits the online amount across lines and preserves the total", () => {
    const lines = [{ lineTotal: 1000 }, { lineTotal: 500 }];
    const shares = allocateProportionally(300, lines);
    expect(shares).toHaveLength(2);
    expect(shares[0]).toBeCloseTo(200, 2);
    expect(shares[1]).toBeCloseTo(100, 2);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(300, 2);
  });

  it("pushes rounding drift into the last line", () => {
    const shares = allocateProportionally(100, [{ lineTotal: 1 }, { lineTotal: 1 }, { lineTotal: 1 }]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it("handles an empty cart without NaN", () => {
    expect(allocateProportionally(100, [])).toEqual([]);
  });
});

describe("Security hardening: simulator gateway", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_SIMULATOR_GATEWAY;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_SIMULATOR_GATEWAY;
    else process.env.ALLOW_SIMULATOR_GATEWAY = originalFlag;
  });

  it("is allowed outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_SIMULATOR_GATEWAY;
    expect(simulatorAllowed()).toBe(true);
  });

  it("is blocked in production by default", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_SIMULATOR_GATEWAY;
    expect(simulatorAllowed()).toBe(false);
  });

  it("can be explicitly opted into in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_SIMULATOR_GATEWAY = "true";
    expect(simulatorAllowed()).toBe(true);
  });
});

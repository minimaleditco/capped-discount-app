export interface CouponRule {
  code: string;
  title: string;
  type: "percentage" | "fixed";
  value: number;
  maxCap?: number;
  minSubtotal?: number;
}

export interface CouponEvaluation {
  valid: boolean;
  coupon?: CouponRule;
  discountAmount: number;
  error?: string;
}

/**
 * Native Shopify discounts (DiscountCodeBasic / DiscountAutomaticBasic) report
 * `percentage` as a fraction: 0.8 means 80%. App discounts configured through
 * our own metafield store a whole number (40 = 40%), so the two must not be
 * confused or an 80% sale would render as 0.8% off.
 */
export function percentFromFraction(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100 * 100) / 100;
}

/** Pure money math — no Shopify imports, so it can be unit tested. */
export function computeCouponDiscount(coupon: CouponRule | undefined, subtotal: number): number {
  if (!coupon) return 0;
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (safeSubtotal <= 0) return 0;

  let discount = 0;
  if (coupon.type === "percentage") {
    discount = Math.round(((safeSubtotal * coupon.value) / 100) * 100) / 100;
    if (coupon.maxCap && discount > coupon.maxCap) discount = coupon.maxCap;
  } else {
    discount = Number(coupon.value) || 0;
  }

  return Math.max(0, Math.min(discount, safeSubtotal));
}

export function findCoupon(coupons: CouponRule[], code: string): CouponRule | undefined {
  const wanted = String(code || "").trim().toUpperCase();
  if (!wanted) return undefined;
  return coupons.find((c) => c.code.toUpperCase() === wanted);
}

/**
 * Server-side coupon validation. A discount can never be applied unless it
 * exists as an ACTIVE discount in the merchant's Shopify admin.
 */
export function evaluateCoupon(
  coupons: CouponRule[],
  code: string,
  subtotal: number
): CouponEvaluation {
  const coupon = findCoupon(coupons, code);
  if (!coupon) {
    return { valid: false, discountAmount: 0, error: `Coupon code '${code}' is invalid or expired.` };
  }

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (coupon.minSubtotal && safeSubtotal < coupon.minSubtotal) {
    return {
      valid: false,
      coupon,
      discountAmount: 0,
      error: `Minimum order amount of ₹${coupon.minSubtotal} required for code '${coupon.code}'.`,
    };
  }

  return { valid: true, coupon, discountAmount: computeCouponDiscount(coupon, safeSubtotal) };
}

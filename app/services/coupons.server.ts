import { unauthenticated } from "../shopify.server";
import { normalizeShopDomain } from "../db.server";
import type { CouponRule } from "./coupon-math";
import { percentFromFraction } from "./coupon-math";

export type { CouponRule, CouponEvaluation } from "./coupon-math";
export { computeCouponDiscount, findCoupon, evaluateCoupon, percentFromFraction } from "./coupon-math";

export interface AutoDiscount {
  id: string;
  title: string;
  percentage: number;
  maxCap: number;
  minSubtotal: number;
  discountAmount: number;
  isAuto: true;
}

export interface LiveDiscounts {
  coupons: CouponRule[];
  autoDiscount: AutoDiscount | null;
  /** True when the Admin API lookup itself failed (not "no discounts configured"). */
  lookupFailed: boolean;
}

const LIVE_DISCOUNTS_QUERY = `#graphql
  query GetLiveStoreDiscounts {
    discountNodes(first: 50) {
      nodes {
        id
        discount {
          __typename
          ... on DiscountCodeApp {
            title
            status
            codes(first: 5) {
              nodes {
                code
              }
            }
          }
          ... on DiscountCodeBasic {
            title
            status
            codes(first: 5) {
              nodes {
                code
              }
            }
            customerGets {
              value {
                ... on DiscountPercentage {
                  percentage
                }
                ... on DiscountAmount {
                  amount {
                    amount
                  }
                }
              }
            }
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                }
              }
            }
          }
          ... on DiscountAutomaticApp {
            title
            status
          }
          ... on DiscountAutomaticBasic {
            title
            status
            customerGets {
              value {
                ... on DiscountPercentage {
                  percentage
                }
                ... on DiscountAmount {
                  amount {
                    amount
                  }
                }
              }
            }
            minimumRequirement {
              ... on DiscountMinimumSubtotal {
                greaterThanOrEqualToSubtotal {
                  amount
                }
              }
            }
          }
        }
        metafield(namespace: "capped_discount", key: "configuration") {
          value
        }
      }
    }
  }
`;

/**
 * Reads the store's live discounts directly from the Shopify Admin API.
 *
 * There is deliberately NO hardcoded fallback list here. Inventing coupon
 * codes that do not exist in the store caused real discounts to be granted
 * on checkout, so an empty store or a failed lookup now returns an empty list.
 */
export async function fetchLiveDiscounts(shop: string): Promise<LiveDiscounts> {
  const cleanShop = normalizeShopDomain(shop);
  const empty: LiveDiscounts = { coupons: [], autoDiscount: null, lookupFailed: false };

  if (!cleanShop) return empty;

  let nodes: any[] = [];

  try {
    const auth = await unauthenticated.admin(cleanShop);
    const res = await auth.admin.graphql(LIVE_DISCOUNTS_QUERY);
    const resData: any = await res.json();
    nodes = resData?.data?.discountNodes?.nodes || [];
  } catch (err: any) {
    console.warn("[Live Shopify Discounts Fetch Error]:", err?.message || err);
    return { ...empty, lookupFailed: true };
  }

  const coupons: CouponRule[] = [];
  let autoDiscount: AutoDiscount | null = null;

  for (const node of nodes) {
    const d = node?.discount;
    if (!d) continue;

    // Only strictly ACTIVE discounts may be offered to shoppers.
    if (String(d.status || "").toUpperCase() !== "ACTIVE") continue;

    // ---------- Automatic discounts ----------
    if (d.__typename === "DiscountAutomaticApp" || d.__typename === "DiscountAutomaticBasic") {
      let percentage = 0;
      let maxCap = 0;
      let minSubtotal = 0;

      if (node.metafield?.value) {
        try {
          const config = JSON.parse(node.metafield.value);
          percentage = Number(config.percentage) || 0;
          maxCap = Number(config.maxCapAmount) || 0;
          minSubtotal = Number(config.minSubtotal) || 0;
        } catch {
          // ignore malformed metafield
        }
      } else if (d.__typename === "DiscountAutomaticBasic") {
        percentage = percentFromFraction(d.customerGets?.value?.percentage);
        minSubtotal = Number(d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount) || 0;
      }

      if (percentage <= 0 || autoDiscount) continue;

      autoDiscount = {
        id: node.id,
        title: d.title || "Storewide Auto Discount",
        percentage,
        maxCap,
        minSubtotal,
        discountAmount: 0,
        isAuto: true,
      };
      continue;
    }

    // ---------- Code discounts ----------
    const codeNode = d.codes?.nodes?.[0];
    if (!codeNode?.code) continue;

    const code = String(codeNode.code).trim().toUpperCase();
    if (!code) continue;

    if (d.__typename === "DiscountCodeApp") {
      let percentage = 0;
      let maxCap = 0;
      let minSubtotal = 0;

      if (node.metafield?.value) {
        try {
          const config = JSON.parse(node.metafield.value);
          percentage = Number(config.percentage) || 0;
          maxCap = Number(config.maxCapAmount) || 0;
          minSubtotal = Number(config.minSubtotal) || 0;
        } catch {
          // ignore malformed metafield
        }
      }

      if (percentage <= 0) continue;

      coupons.push({
        code,
        title: d.title || `${percentage}% OFF${maxCap ? ` (Max ₹${maxCap})` : ""}`,
        type: "percentage",
        value: percentage,
        maxCap: maxCap || undefined,
        minSubtotal: minSubtotal || undefined,
      });
    } else if (d.__typename === "DiscountCodeBasic") {
      const pct = d.customerGets?.value?.percentage;
      const pctPercent = pct ? percentFromFraction(pct) : 0;
      const amt = d.customerGets?.value?.amount?.amount;
      const minReq = d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount;
      const minSubtotal = minReq ? parseFloat(minReq) : undefined;

      if (pctPercent) {
        coupons.push({
          code,
          title: d.title || `${pctPercent}% OFF`,
          type: "percentage",
          value: pctPercent,
          minSubtotal,
        });
      } else if (amt) {
        coupons.push({
          code,
          title: d.title || `Flat ₹${amt} OFF`,
          type: "fixed",
          value: parseFloat(amt),
          minSubtotal,
        });
      }
    }
    // BXGY, free-shipping and other discount types are intentionally skipped:
    // their value cannot be expressed as a simple rupee amount here, and
    // guessing produced bogus "₹0 off" coupons.
  }

  return { coupons, autoDiscount, lookupFailed: false };
}

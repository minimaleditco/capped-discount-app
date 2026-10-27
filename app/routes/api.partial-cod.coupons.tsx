import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getPartialCodSettings, normalizeShopDomain } from "../db.server";
import { unauthenticated } from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleRequest(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleRequest(request);
};

interface CouponRule {
  code: string;
  title: string;
  type: "percentage" | "fixed";
  value: number;
  maxCap?: number;
  minSubtotal?: number;
}

async function handleRequest(request: Request) {
  try {
    let shop = "";
    let subtotal = 0;
    let code = "";

    if (request.method === "POST") {
      try {
        const body = await request.json();
        shop = body.shop || "";
        subtotal = parseFloat(String(body.subtotal || 0));
        code = String(body.code || "").trim();
      } catch {}
    } else {
      const url = new URL(request.url);
      shop = url.searchParams.get("shop") || "";
      subtotal = parseFloat(url.searchParams.get("subtotal") || "0");
      code = url.searchParams.get("code") || "";
    }

    const cleanShop = normalizeShopDomain(shop);
    const settings = await getPartialCodSettings(cleanShop);

    const prepaidOffer = {
      enabled: settings.prepaidDiscountEnabled ?? true,
      type: settings.prepaidDiscountType || "percentage",
      value: Number(settings.prepaidDiscountValue ?? 5),
      badgeText: settings.prepaidDiscountBadge || "⚡ Extra 5% OFF on Prepaid",
    };

    // Query LIVE discounts directly from Shopify Admin API
    const liveCoupons: CouponRule[] = [];
    let autoDiscount: any = null;

    try {
      const auth = await unauthenticated.admin(cleanShop);
      const discountQuery = `#graphql
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
                ... on DiscountCodeBxgy {
                  title
                  status
                  codes(first: 5) {
                    nodes {
                      code
                    }
                  }
                }
                ... on DiscountCodeFreeShipping {
                  title
                  status
                  codes(first: 5) {
                    nodes {
                      code
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

      const res = await auth.admin.graphql(discountQuery);
      const resData: any = await res.json();
      const nodes = resData?.data?.discountNodes?.nodes || [];

      for (const node of nodes) {
        const d = node.discount;
        if (!d) continue;

        // CRUCIAL: Only consider discounts that are strictly ACTIVE!
        const status = String(d.status || "").toUpperCase();
        if (status !== "ACTIVE") {
          continue;
        }

        // 1. Process Automatic Discounts
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
            } catch {}
          } else if (d.__typename === "DiscountAutomaticBasic") {
            percentage = Number(d.customerGets?.value?.percentage) || 0;
            minSubtotal = Number(d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount) || 0;
          }

          let calculatedAmount = 0;
          if (subtotal >= minSubtotal && percentage > 0) {
            calculatedAmount = (subtotal * percentage) / 100;
            if (maxCap > 0 && calculatedAmount > maxCap) {
              calculatedAmount = maxCap;
            }
          }
          calculatedAmount = Math.min(calculatedAmount, subtotal);

          // ONLY lock in an automatic discount if it actually provides savings (> 0)!
          if (calculatedAmount > 0 && !autoDiscount) {
            autoDiscount = {
              id: node.id,
              title: d.title || "Storewide Auto Discount",
              percentage,
              maxCap,
              minSubtotal,
              discountAmount: Math.round(calculatedAmount * 100) / 100,
              isAuto: true,
            };
          }
          continue;
        }

        // 2. Process Code Discounts (Coupons)
        const codeNode = d.codes?.nodes?.[0];
        if (!codeNode || !codeNode.code) continue;

        const couponCode = String(codeNode.code).trim().toUpperCase();

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
            } catch {}
          }

          liveCoupons.push({
            code: couponCode,
            title: d.title || `${percentage}% OFF${maxCap ? ` (Max ₹${maxCap})` : ""}`,
            type: "percentage",
            value: percentage,
            maxCap: maxCap || undefined,
            minSubtotal: minSubtotal || undefined,
          });
        } else if (d.__typename === "DiscountCodeBasic") {
          const pct = d.customerGets?.value?.percentage;
          const amt = d.customerGets?.value?.amount?.amount;
          const minReq = d.minimumRequirement?.greaterThanOrEqualToSubtotal?.amount;
          const minSubtotal = minReq ? parseFloat(minReq) : undefined;

          if (pct) {
            liveCoupons.push({
              code: couponCode,
              title: d.title || `${pct}% OFF`,
              type: "percentage",
              value: Number(pct),
              minSubtotal,
            });
          } else if (amt) {
            liveCoupons.push({
              code: couponCode,
              title: d.title || `Flat ₹${amt} OFF`,
              type: "fixed",
              value: parseFloat(amt),
              minSubtotal,
            });
          }
        } else {
          // Bxgy or Free Shipping
          liveCoupons.push({
            code: couponCode,
            title: d.title || couponCode,
            type: "fixed",
            value: 0,
          });
        }
      }
    } catch (err) {
      console.warn("[Live Shopify Discounts Fetch Error]:", err);
    }

    // If no code was entered, return the live list of coupons and auto discount
    if (!code) {
      return json(
        {
          success: true,
          autoDiscount,
          coupons: liveCoupons,
          prepaidOffer,
        },
        { headers: corsHeaders }
      );
    }

    // Evaluate coupon entered by customer
    const normalizedCode = code.toUpperCase().trim();
    const matchedRule = liveCoupons.find(
      (c) => c.code.toUpperCase() === normalizedCode
    );

    if (!matchedRule) {
      return json(
        {
          valid: false,
          error: `Coupon code '${code}' is invalid or expired.`,
          coupons: liveCoupons,
          prepaidOffer,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (matchedRule.minSubtotal && subtotal < matchedRule.minSubtotal) {
      return json(
        {
          valid: false,
          error: `Minimum order amount of ₹${matchedRule.minSubtotal} required for code '${matchedRule.code}'.`,
          coupons: liveCoupons,
          prepaidOffer,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Calculate coupon discount amount
    let discountAmount = 0;
    if (matchedRule.type === "percentage") {
      discountAmount = Math.round(((subtotal * matchedRule.value) / 100) * 100) / 100;
      if (matchedRule.maxCap && discountAmount > matchedRule.maxCap) {
        discountAmount = matchedRule.maxCap;
      }
    } else {
      discountAmount = matchedRule.value;
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const effectiveSubtotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Calculate extra prepaid discount on effective subtotal
    let extraPrepaidDiscount = 0;
    if (prepaidOffer.enabled && prepaidOffer.value > 0) {
      if (prepaidOffer.type === "percentage") {
        extraPrepaidDiscount = Math.round(((effectiveSubtotal * prepaidOffer.value) / 100) * 100) / 100;
      } else {
        extraPrepaidDiscount = prepaidOffer.value;
      }
      extraPrepaidDiscount = Math.min(extraPrepaidDiscount, effectiveSubtotal);
    }

    const prepaidTotal = Math.max(0, Math.round((effectiveSubtotal - extraPrepaidDiscount) * 100) / 100);

    // Calculate dynamic deposit (e.g. 10% or ₹100 min)
    let deposit = effectiveSubtotal > 100 ? 100 : effectiveSubtotal;
    if (settings.depositType === "percentage") {
      deposit = Math.round(((effectiveSubtotal * settings.depositValue) / 100) * 100) / 100;
    } else {
      deposit = settings.depositValue;
    }
    deposit = Math.min(deposit, effectiveSubtotal);
    const balance = Math.max(0, Math.round((effectiveSubtotal - deposit) * 100) / 100);

    return json(
      {
        valid: true,
        code: matchedRule.code,
        title: matchedRule.title,
        discountAmount,
        discountSummary: matchedRule.type === "percentage"
          ? `${matchedRule.value}% OFF (Save ₹${discountAmount.toLocaleString("en-IN")})`
          : `Flat ₹${discountAmount.toLocaleString("en-IN")} OFF`,
        originalSubtotal: subtotal,
        newSubtotal: effectiveSubtotal,
        prepaidDiscount: extraPrepaidDiscount,
        prepaidTotal,
        depositAmount: deposit,
        balanceAmount: balance,
        prepaidOffer,
        coupons: liveCoupons,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return json(
      { valid: false, error: err?.message || "Failed to calculate coupon discount." },
      { status: 500, headers: corsHeaders }
    );
  }
}

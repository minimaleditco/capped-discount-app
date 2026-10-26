import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getPartialCodSettings, normalizeShopDomain } from "../db.server";

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

const DEFAULT_COUPONS: CouponRule[] = [
  { code: "SAVE10", title: "10% OFF on all items", type: "percentage", value: 10, maxCap: 100 },
  { code: "FLAT50", title: "Flat ₹50 OFF", type: "fixed", value: 50, minSubtotal: 299 },
  { code: "CAP20", title: "20% OFF (Max ₹200)", type: "percentage", value: 20, maxCap: 200, minSubtotal: 500 },
];

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

    let parsedCoupons: CouponRule[] = DEFAULT_COUPONS;
    try {
      if (settings.availableCoupons) {
        const custom = JSON.parse(settings.availableCoupons);
        if (Array.isArray(custom) && custom.length > 0) {
          parsedCoupons = custom;
        }
      }
    } catch {}

    const prepaidOffer = {
      enabled: settings.prepaidDiscountEnabled ?? true,
      type: settings.prepaidDiscountType || "percentage",
      value: Number(settings.prepaidDiscountValue ?? 5),
      badgeText: settings.prepaidDiscountBadge || "⚡ Extra 5% OFF on Prepaid",
    };

    // If no code provided, just return available offers and prepaid configuration
    if (!code) {
      return json(
        {
          success: true,
          coupons: parsedCoupons,
          prepaidOffer,
        },
        { headers: corsHeaders }
      );
    }

    // Evaluate coupon
    const normalizedCode = code.toUpperCase().trim();
    let matchedRule = parsedCoupons.find(
      (c) => c.code.toUpperCase() === normalizedCode
    );

    // Dynamic fallback pattern matching for common merchant codes if not in list
    if (!matchedRule) {
      const pctMatch = normalizedCode.match(/(?:SAVE|OFF|DISC|FLAT)?(\d{1,2})/);
      if (pctMatch && pctMatch[1]) {
        const pct = parseInt(pctMatch[1], 10);
        if (pct > 0 && pct <= 90) {
          matchedRule = {
            code: normalizedCode,
            title: `${pct}% OFF`,
            type: "percentage",
            value: pct,
          };
        }
      }
    }

    if (!matchedRule) {
      return json(
        {
          valid: false,
          error: `Coupon code '${code}' is invalid or expired.`,
          coupons: parsedCoupons,
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
          coupons: parsedCoupons,
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
        coupons: parsedCoupons,
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

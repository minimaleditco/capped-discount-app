import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getPartialCodSettings, normalizeShopDomain } from "../db.server";
import {
  computeCouponDiscount,
  evaluateCoupon,
  fetchLiveDiscounts,
} from "../services/coupons.server";

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
    if (!cleanShop) {
      return json(
        { success: false, valid: false, error: "Missing required parameter: shop" },
        { status: 400, headers: corsHeaders }
      );
    }

    const settings = await getPartialCodSettings(cleanShop);

    const prepaidOffer = {
      enabled: settings.prepaidDiscountEnabled ?? true,
      type: settings.prepaidDiscountType || "percentage",
      value: Number(settings.prepaidDiscountValue ?? 5),
      badgeText: settings.prepaidDiscountBadge || "⚡ Extra 5% OFF on Prepaid",
    };

    const depositSettings = {
      type: settings.depositType || "percentage",
      value: Number(settings.depositValue ?? 10),
    };

    const { coupons, autoDiscount } = await fetchLiveDiscounts(cleanShop);

    // If no code was entered, return the live list of coupons, auto discount, and store deposit settings
    if (!code) {
      const autoWithAmount = autoDiscount
        ? {
            ...autoDiscount,
            discountAmount:
              subtotal >= autoDiscount.minSubtotal
                ? Math.min(
                    Math.round(((subtotal * autoDiscount.percentage) / 100) * 100) / 100,
                    autoDiscount.maxCap > 0 ? autoDiscount.maxCap : Number.POSITIVE_INFINITY,
                    subtotal
                  )
                : 0,
          }
        : null;

      return json(
        {
          success: true,
          autoDiscount: autoWithAmount,
          coupons,
          prepaidOffer,
          depositSettings,
        },
        { headers: corsHeaders }
      );
    }

    const evaluation = evaluateCoupon(coupons, code, subtotal);

    if (!evaluation.valid) {
      return json(
        {
          valid: false,
          error: evaluation.error,
          coupons,
          prepaidOffer,
          depositSettings,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const matchedRule = evaluation.coupon!;
    const discountAmount = evaluation.discountAmount;
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

    // Calculate dynamic flexible deposit (e.g. 10% of discounted subtotal, not flat 100)
    let deposit = 0;
    if (depositSettings.type === "percentage") {
      deposit = Math.round(((effectiveSubtotal * depositSettings.value) / 100) * 100) / 100;
    } else {
      deposit = Math.min(effectiveSubtotal, depositSettings.value);
    }
    deposit = Math.max(1, Math.min(effectiveSubtotal, deposit));
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
        depositSettings,
        prepaidOffer,
        coupons,
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

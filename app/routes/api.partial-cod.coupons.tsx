import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getDepositRules, getPartialCodSettings, normalizeShopDomain } from "../db.server";
import { unauthenticated } from "../shopify.server";
import { calculateDraftPricing } from "../services/draft-pricing.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";
import { fetchLiveDiscounts } from "../services/coupons.server";

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

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function handleRequest(request: Request) {
  try {
    let shop = "";
    let subtotal = 0;
    let code = "";
    let pincode = "";
    let currency = "";
    let items: any[] = [];

    if (request.method === "POST") {
      try {
        const body = await request.json();
        shop = body.shop || "";
        subtotal = parseFloat(String(body.subtotal || 0));
        code = String(body.code || "").trim();
        pincode = String(body.pincode || "").trim();
        currency = String(body.currency || "").trim();
        items = Array.isArray(body.items) ? body.items : [];
      } catch {}
    } else {
      const url = new URL(request.url);
      shop = url.searchParams.get("shop") || "";
      subtotal = parseFloat(url.searchParams.get("subtotal") || "0");
      code = url.searchParams.get("code") || "";
      pincode = url.searchParams.get("pincode") || "";
      currency = url.searchParams.get("currency") || "";
      try {
        const parsed = JSON.parse(url.searchParams.get("items") || "[]");
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
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

    const depositRules = await getDepositRules(cleanShop);
    const requiresPincode = depositRules.some((rule) => rule.conditionType === "Pincode");

    // Coupon chips still list the store's live code discounts. Their amounts
    // are informational only; every charged number comes from Shopify's own
    // draft order calculation below.
    const { coupons } = await fetchLiveDiscounts(cleanShop);

    // ---------------------------------------------------------------------
    // Authoritative pricing.
    //
    // Shopify calculates a draft order for the exact lines and code, applying
    // automatic discounts with their real scope and stacking rules. We read
    // that total instead of re-deriving discounts from percentages.
    // ---------------------------------------------------------------------
    let pricing: Awaited<ReturnType<typeof calculateDraftPricing>> | null = null;
    if (items.length > 0) {
      try {
        const auth = await unauthenticated.admin(cleanShop);
        pricing = await calculateDraftPricing(auth.admin, items, code);
      } catch (err: any) {
        console.warn("[Quote Pricing Error]:", err?.message || err);
        pricing = null;
      }
    }

    const effectiveSubtotal = pricing ? pricing.discountedSubtotal : Math.max(0, round2(subtotal));
    const catalogSubtotal = pricing ? pricing.catalogSubtotal : Math.max(0, round2(subtotal));
    const appliedDiscount = pricing ? pricing.totalDiscount : 0;
    const quoteCurrency = pricing?.currencyCode || currency;
    const appliedCodes = pricing?.appliedCodes || [];

    const fmt = (value: number) => {
      try {
        return new Intl.NumberFormat("en", {
          style: "currency",
          currency: quoteCurrency || "INR",
        }).format(value);
      } catch {
        return value.toFixed(2);
      }
    };

    // ---------------------------------------------------------------------
    // Deposit rules run against the Shopify-calculated total, so pincode,
    // cart value and SKU rules see the same numbers the invoice will use.
    // ---------------------------------------------------------------------
    const ruleLines = pricing
      ? pricing.lines.map((line) => ({
          title: line.title,
          sku: line.sku,
          variantId: line.variantId,
          price: line.unitPrice,
          quantity: line.quantity,
        }))
      : items.map((it: any) => ({
          title: it?.title,
          sku: it?.sku,
          variantId: it?.variantId,
          price: Number(it?.price) || 0,
          quantity: Number(it?.quantity) || 1,
        }));

    const evaluation =
      effectiveSubtotal > 0
        ? await evaluateDepositRules(cleanShop, {
            totalPrice: effectiveSubtotal,
            currency: quoteCurrency || undefined,
            pincode,
            lineItems: ruleLines,
          })
        : null;

    const deposit = evaluation
      ? Math.max(1, Math.min(effectiveSubtotal, Number(evaluation.deposit) || 0))
      : 0;

    let prepaidDiscount = 0;
    if (prepaidOffer.enabled && prepaidOffer.value > 0 && effectiveSubtotal > 0) {
      prepaidDiscount =
        prepaidOffer.type === "percentage"
          ? Math.round(((effectiveSubtotal * Math.min(prepaidOffer.value, 100)) / 100) * 100) / 100
          : prepaidOffer.value;
      prepaidDiscount = Math.min(prepaidDiscount, effectiveSubtotal);
    }
    const prepaidTotal = Math.max(0, round2(effectiveSubtotal - prepaidDiscount));

    const quote = {
      currency: quoteCurrency,
      subtotal: catalogSubtotal,
      discountAmount: appliedDiscount,
      discountTitle: appliedDiscount > 0 ? "Shopify discount" : "",
      effectiveTotal: effectiveSubtotal,
      deposit,
      balance: Math.max(0, round2(effectiveSubtotal - deposit)),
      ruleSummary: evaluation?.ruleSummary || "",
      prepaidDiscount,
      prepaidTotal,
      prepaidSavings: Math.max(0, round2(catalogSubtotal - prepaidTotal)),
    };

    const codeApplied = code
      ? appliedCodes.some((value) => value.toUpperCase() === code.toUpperCase())
      : false;

    const baseResponse = {
      coupons,
      prepaidOffer,
      depositSettings,
      requiresPincode,
      quote,
      autoDiscount:
        !code && appliedDiscount > 0
          ? {
              id: "auto",
              code: "AUTO",
              title: "Shopify automatic discount",
              percentage: 0,
              maxCap: 0,
              minSubtotal: 0,
              discountAmount: appliedDiscount,
              isAuto: true,
            }
          : null,
    };

    // No code typed: return the offer list plus the authoritative quote.
    if (!code) {
      return json({ success: true, ...baseResponse }, { headers: corsHeaders });
    }

    if (!codeApplied) {
      return json(
        {
          success: false,
          valid: false,
          error: "This coupon code is invalid or not applicable to this order.",
          ...baseResponse,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    return json(
      {
        success: true,
        valid: true,
        code: appliedCodes[0] || code,
        title: appliedCodes[0] || code,
        discountAmount: appliedDiscount,
        discountSummary: `${fmt(appliedDiscount)} off with ${appliedCodes[0] || code}`,
        originalSubtotal: catalogSubtotal,
        newSubtotal: effectiveSubtotal,
        prepaidDiscount,
        prepaidTotal,
        depositAmount: deposit,
        balanceAmount: quote.balance,
        ...baseResponse,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return json(
      { success: false, valid: false, error: err?.message || "Failed to calculate pricing." },
      { status: 500, headers: corsHeaders }
    );
  }
}

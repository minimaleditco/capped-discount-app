import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getDepositRules, getPartialCodSettings, normalizeShopDomain } from "../db.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";
import {
  computeAutoDiscountAmount,
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
        const rawItems = url.searchParams.get("items") || "[]";
        const parsed = JSON.parse(rawItems);
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

    // The draft order is created before the shopper reaches Shopify checkout,
    // so a pincode-based rule can only work if the widget asks for the pincode.
    const depositRules = await getDepositRules(cleanShop);
    const requiresPincode = depositRules.some((rule) => rule.conditionType === "Pincode");

    // ---------------------------------------------------------------------
    // Server-authoritative quote for the storefront popup.
    //
    // The popup used to compute the deposit in the browser from the store
    // default alone, so any pincode / cart value / SKU rule was ignored and
    // the amount shown never matched the draft order. Every number the
    // shopper sees now comes from the same helpers the draft order uses.
    // ---------------------------------------------------------------------
    const fmt = (value: number) => {
      try {
        return new Intl.NumberFormat("en", {
          style: "currency",
          currency: currency || "INR",
        }).format(value);
      } catch {
        return value.toFixed(2);
      }
    };

    const buildQuote = async (discountAmount: number, discountTitle: string) => {
      const applied = Math.max(0, Math.round((Number(discountAmount) || 0) * 100) / 100);
      const effectiveTotal = Math.max(0, Math.round((subtotal - applied) * 100) / 100);

      const evaluation =
        effectiveTotal > 0
          ? await evaluateDepositRules(cleanShop, {
              totalPrice: effectiveTotal,
              currency: currency || undefined,
              pincode,
              lineItems: items.map((it: any) => ({
                sku: it?.sku ? String(it.sku) : undefined,
                variantId: it?.variantId,
                price: Number(it?.price) || 0,
                quantity: Number(it?.quantity) || 1,
              })),
            })
          : null;

      const deposit = evaluation
        ? Math.max(1, Math.min(effectiveTotal, Number(evaluation.deposit) || 0))
        : 0;

      let prepaidDiscount = 0;
      if (prepaidOffer.enabled && prepaidOffer.value > 0 && effectiveTotal > 0) {
        prepaidDiscount =
          prepaidOffer.type === "percentage"
            ? Math.round(((effectiveTotal * Math.min(prepaidOffer.value, 100)) / 100) * 100) / 100
            : prepaidOffer.value;
        prepaidDiscount = Math.min(prepaidDiscount, effectiveTotal);
      }
      const prepaidTotal = Math.max(0, Math.round((effectiveTotal - prepaidDiscount) * 100) / 100);

      return {
        currency,
        subtotal,
        discountAmount: applied,
        discountTitle,
        effectiveTotal,
        deposit,
        balance: Math.max(0, Math.round((effectiveTotal - deposit) * 100) / 100),
        ruleSummary: evaluation?.ruleSummary || "",
        prepaidDiscount,
        prepaidTotal,
        prepaidSavings: Math.max(0, Math.round((subtotal - prepaidTotal) * 100) / 100),
      };
    };

    const { coupons, autoDiscount } = await fetchLiveDiscounts(cleanShop);
    const autoAmount = autoDiscount ? computeAutoDiscountAmount(autoDiscount, subtotal) : 0;

    // If no code was entered, return the live list of coupons, auto discount, and store deposit settings
    if (!code) {
      const autoWithAmount = autoDiscount
        ? {
            ...autoDiscount,
            discountAmount: computeAutoDiscountAmount(autoDiscount, subtotal),
          }
        : null;

      return json(
        {
          success: true,
          autoDiscount: autoWithAmount,
          coupons,
          prepaidOffer,
          depositSettings,
          requiresPincode,
          quote: await buildQuote(autoAmount, autoDiscount?.title || ""),
        },
        { headers: corsHeaders }
      );
    }

    const evaluation = evaluateCoupon(coupons, code, subtotal, currency || undefined);

    if (!evaluation.valid) {
      return json(
        {
          valid: false,
          error: evaluation.error,
          coupons,
          prepaidOffer,
          depositSettings,
          requiresPincode,
          quote: await buildQuote(autoAmount, autoDiscount?.title || ""),
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const matchedRule = evaluation.coupon!;
    const discountAmount = evaluation.discountAmount;

    // The draft order charges the better of (typed code, automatic discount),
    // so the quote must use the same base or the popup would drift from the
    // amount actually charged.
    const appliedForQuote = Math.max(discountAmount, autoAmount);
    const quote = await buildQuote(
      appliedForQuote,
      discountAmount >= autoAmount ? matchedRule.title : autoDiscount?.title || ""
    );

    const effectiveSubtotal = quote.effectiveTotal;
    const extraPrepaidDiscount = quote.prepaidDiscount;
    const prepaidTotal = quote.prepaidTotal;
    const deposit = quote.deposit;
    const balance = quote.balance;

    return json(
      {
        valid: true,
        code: matchedRule.code,
        title: matchedRule.title,
        discountAmount,
        discountSummary: matchedRule.type === "percentage"
          ? `${matchedRule.value}% OFF (Save ${fmt(discountAmount)})`
          : `Flat ${fmt(discountAmount)} OFF`,
        originalSubtotal: subtotal,
        newSubtotal: effectiveSubtotal,
        prepaidDiscount: extraPrepaidDiscount,
        prepaidTotal,
        depositAmount: deposit,
        balanceAmount: balance,
        depositSettings,
        prepaidOffer,
        coupons,
        requiresPincode,
        quote,
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

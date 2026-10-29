import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  normalizeShopDomain,
  validateVerificationToken,
} from "../db.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";
import { fetchLiveDiscounts, evaluateCoupon, computeAutoDiscountAmount } from "../services/coupons.server";
import {
  allocateProportionally,
  resolveLineItems,
  type RawLineItem,
} from "../services/pricing.server";

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
  return json({ ok: true, endpoint: "draft-checkout" }, { headers: corsHeaders });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await request.json();

    // ---------------------------------------------------------------------
    // 1. Resolve the shop. An unknown shop must never fall back to a
    //    hardcoded dev store, otherwise production traffic lands there.
    // ---------------------------------------------------------------------
    const shop = normalizeShopDomain(body.shop);
    if (!shop) {
      return json(
        { success: false, error: "Missing required parameter: shop" },
        { status: 400, headers: corsHeaders }
      );
    }

    let admin: any;
    try {
      const authResult = await unauthenticated.admin(shop);
      admin = authResult.admin;
    } catch (sessionErr: any) {
      console.error("[Draft Checkout Session Error]:", sessionErr);
      return json(
        {
          success: false,
          error:
            "Store authorization required: Please open the 'Capped Discount & COD Fee' app in your Shopify Admin once to authenticate.",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // ---------------------------------------------------------------------
    // 2. Price every line from Shopify. Client-supplied prices are ignored.
    // ---------------------------------------------------------------------
    const rawItems: RawLineItem[] = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : body.variantId
      ? [{ variantId: body.variantId, quantity: body.quantity }]
      : [];

    const resolved = await resolveLineItems(admin, rawItems);
    if (!resolved.ok) {
      return json(
        { success: false, error: resolved.error || "Unable to price this order." },
        { status: 400, headers: corsHeaders }
      );
    }

    const lines = resolved.lines;
    const subtotal = resolved.subtotal;
    const currencyCode = resolved.currencyCode;

    if (subtotal <= 0) {
      return json(
        { success: false, error: "This cart has no payable value." },
        { status: 400, headers: corsHeaders }
      );
    }

    const isPrepaid = body.isPrepaid === true;
    const settings = await getPartialCodSettings(shop);

    // ---------------------------------------------------------------------
    // 3. Resolve the discount that actually applies to this order.
    //
    //    Two independent sources exist:
    //      - a code the shopper typed (validated against live Shopify discounts)
    //      - a Shopify *automatic* discount, which Shopify already applies to
    //        the storefront cart but which draft orders do NOT inherit.
    //
    //    The app charges the deposit itself, so it must reproduce the same
    //    number. Code and automatic discounts are treated as mutually
    //    exclusive: whichever saves the customer more wins. Stacking them here
    //    would hand out a discount Shopify never agreed to.
    // ---------------------------------------------------------------------
    const requestedCode = String(body.couponCode || "").trim();

    let couponCode = "";
    let couponDiscount = 0;
    let autoDiscount = 0;
    let autoTitle = "";

    const { coupons, autoDiscount: liveAuto, lookupFailed } = await fetchLiveDiscounts(shop);

    if (requestedCode) {
      if (lookupFailed) {
        return json(
          { success: false, error: "Could not verify this coupon right now. Please try again." },
          { status: 503, headers: corsHeaders }
        );
      }

      const evaluation = evaluateCoupon(coupons, requestedCode, subtotal);
      if (!evaluation.valid) {
        return json(
          { success: false, error: evaluation.error || "This coupon is not valid for this order." },
          { status: 400, headers: corsHeaders }
        );
      }

      couponDiscount = evaluation.discountAmount;
      if (couponDiscount > 0) couponCode = evaluation.coupon!.code;
    }

    if (liveAuto) {
      autoDiscount = computeAutoDiscountAmount(liveAuto, subtotal);
      if (autoDiscount > 0) autoTitle = liveAuto.title || "Store automatic discount";
    }

    const useCoupon = couponDiscount >= autoDiscount && couponDiscount > 0;
    const appliedDiscount = useCoupon ? couponDiscount : autoDiscount;
    if (!useCoupon) couponCode = "";

    const effectiveTotalPrice = Math.max(0, Math.round((subtotal - appliedDiscount) * 100) / 100);

    // ---------------------------------------------------------------------
    // 4. Verify WhatsApp / SMS OTP for COD orders only.
    // ---------------------------------------------------------------------
    const customerPhone = String(body.phone || body.customerPhone || "").replace(/[^0-9]/g, "");
    const otpToken = String(body.otpToken || body.token || "").trim();

    if (!isPrepaid && settings.whatsappEnabled) {
      const isVerified = await validateVerificationToken(shop, customerPhone, otpToken);
      if (!isVerified) {
        return json(
          {
            success: false,
            error:
              "Mobile number verification required. Please verify the OTP sent to your mobile number before placing a Partial COD order.",
            requiresOtp: true,
          },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // ---------------------------------------------------------------------
    // 5. Decide how much is actually charged online.
    // ---------------------------------------------------------------------
    let onlineAmount: number;
    let balance: number;
    let ruleSummary = "Store Default";
    let matchedRuleType: string | null = null;

    if (isPrepaid) {
      let prepaidDiscount = 0;
      if (settings.prepaidDiscountEnabled && effectiveTotalPrice > 0) {
        const promoValue = Math.max(0, Number(settings.prepaidDiscountValue) || 0);
        if (settings.prepaidDiscountType === "fixed") {
          prepaidDiscount = Math.min(promoValue, effectiveTotalPrice);
        } else {
          prepaidDiscount = Math.min(
            Math.round(((effectiveTotalPrice * Math.min(promoValue, 100)) / 100) * 100) / 100,
            effectiveTotalPrice
          );
        }
      }

      onlineAmount = Math.max(0, Math.round((effectiveTotalPrice - prepaidDiscount) * 100) / 100);
      balance = 0;
      ruleSummary = "Full Prepaid Order";
    } else {
      // Deposit is ALWAYS derived from the risk rules engine against the
      // net (post-coupon) total. `body.deposit` is intentionally ignored.
      const evaluation = await evaluateDepositRules(shop, {
        totalPrice: effectiveTotalPrice,
        currency: currencyCode,
        lineItems: lines.map((l) => ({
          title: l.title,
          sku: l.sku,
          variantId: l.variantId,
          price: l.unitPrice,
          quantity: l.quantity,
        })),
        pincode: body.pincode || body.shippingAddress?.zip,
        shippingAddress: body.shippingAddress,
      });

      onlineAmount = Math.max(1, Math.min(effectiveTotalPrice, evaluation.deposit));
      balance = Math.max(0, Math.round((effectiveTotalPrice - onlineAmount) * 100) / 100);
      ruleSummary = evaluation.ruleSummary;
      matchedRuleType = evaluation.matchedRule?.conditionType ?? null;
    }

    // ---------------------------------------------------------------------
    // 6. Build the draft order with a server-computed price override.
    // ---------------------------------------------------------------------
    const shares = allocateProportionally(onlineAmount, lines);

    const lineItemsForDraft = lines.map((line, index) => {
      const lineShare = shares[index] ?? 0;
      const unitShare = Math.max(0, Math.round((lineShare / line.quantity) * 100) / 100);

      return {
        variantId: line.variantId,
        quantity: line.quantity,
        priceOverride: {
          amount: unitShare.toFixed(2),
          currencyCode,
        },
        customAttributes: [
          { key: "Catalog Unit Price", value: `₹${line.unitPrice.toFixed(2)}` },
          { key: "Net Product Total", value: `₹${line.lineTotal.toFixed(2)}` },
        ],
      };
    });

    const tags: string[] = isPrepaid
      ? [
          "Prepaid",
          "Paid Online",
          `Total Paid Online: ₹${onlineAmount}`,
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ₹${couponDiscount}`] : []),
        ]
      : [
          "Partially Paid",
          "Partial COD",
          `Deposit Paid: ₹${onlineAmount}`,
          `Doorstep Balance: ₹${balance}`,
          `Collect ₹${balance} on Delivery`,
          matchedRuleType ? `Rule: ${matchedRuleType}` : "Rule: Store Default",
          ...(customerPhone ? [`SMS Verified: +91${customerPhone}`] : []),
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ₹${couponDiscount}`] : []),
        ];

    const discountNoteLine =
      appliedDiscount > 0
        ? `\n• Discount Applied: -₹${appliedDiscount.toFixed(2)} (${useCoupon ? `code ${couponCode}` : `automatic: ${autoTitle}`})`
        : "";

    if (appliedDiscount > 0) {
      tags.push(
        useCoupon ? `Coupon: ${couponCode}` : "Automatic Discount",
        `Discount: ₹${appliedDiscount}`
      );
    } else {
      tags.push("No Discount");
    }

    const note = isPrepaid
      ? `[FULL PREPAID ORDER] • Amount Paid: ₹${onlineAmount.toFixed(2)}${
          couponCode ? `\n• Coupon Applied: ${couponCode} (-₹${couponDiscount.toFixed(2)})` : ""
        }${discountNoteLine}`
      : `[PARTIALLY PAID] • Advance Deposit (Paid Online): ₹${onlineAmount.toFixed(2)}\n• Remaining COD Balance (To Collect in Cash at Doorstep): ₹${balance.toFixed(2)}\n• Dynamic Rule: ${ruleSummary}${
          couponCode ? `\n• Coupon Applied: ${couponCode} (-₹${couponDiscount.toFixed(2)})` : ""
        }${discountNoteLine}${customerPhone ? `\n• Verified Mobile (SMS): +91${customerPhone}` : ""}`;

    const customAttributes = isPrepaid
      ? [
          { key: "Payment Type", value: "Prepaid Online" },
          { key: "Prepaid Total Paid", value: `₹${onlineAmount.toFixed(2)}` },
          ...(couponCode
            ? [
                { key: "Coupon Code", value: couponCode },
                { key: "Coupon Discount", value: `₹${couponDiscount.toFixed(2)}` },
              ]
            : []),
          { key: "Order Subtotal (Verified)", value: `₹${subtotal.toFixed(2)}` },
          { key: "single_coupon_policy_enforced", value: "true" },
        ]
      : [
          { key: "Payment Status", value: "Partially Paid" },
          { key: "Advance Deposit Paid", value: `₹${onlineAmount.toFixed(2)}` },
          { key: "Doorstep COD Balance Due", value: `₹${balance.toFixed(2)}` },
          { key: "Order Subtotal (Verified)", value: `₹${subtotal.toFixed(2)}` },
          ...(customerPhone ? [{ key: "Verified Mobile", value: customerPhone }] : []),
          ...(couponCode
            ? [
                { key: "Coupon Code", value: couponCode },
                { key: "Coupon Discount", value: `₹${couponDiscount.toFixed(2)}` },
              ]
            : []),
          { key: "Deposit Rule Applied", value: ruleSummary },
          { key: "partial_cod_order", value: "true" },
          { key: "single_coupon_policy_enforced", value: "true" },
        ];

    const draftOrderMutation = `#graphql
      mutation CreatePartialCodDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log("[Draft Checkout] Creating draft order:", {
      shop,
      subtotal,
      couponCode,
      couponDiscount,
      isPrepaid,
      onlineAmount,
      balance,
    });

    const response = await admin.graphql(draftOrderMutation, {
      variables: {
        input: {
          lineItems: lineItemsForDraft,
          tags,
          note,
          customAttributes,
        },
      },
    });

    const resJson: any = await response.json();

    if (resJson.data?.draftOrderCreate?.userErrors?.length > 0) {
      const errMsg = resJson.data.draftOrderCreate.userErrors.map((e: any) => e.message).join(", ");
      return json({ success: false, error: errMsg }, { status: 400, headers: corsHeaders });
    }

    const draftOrder = resJson.data?.draftOrderCreate?.draftOrder;
    if (!draftOrder?.invoiceUrl) {
      return json(
        { success: false, error: "Failed to generate Shopify checkout URL." },
        { status: 500, headers: corsHeaders }
      );
    }

    return json(
      {
        success: true,
        invoiceUrl: draftOrder.invoiceUrl,
        draftOrderId: draftOrder.id,
        draftOrderName: draftOrder.name,
        deposit: onlineAmount,
        balance,
        total: subtotal,
        currency: currencyCode,
        couponCode: couponCode || null,
        couponDiscount,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("[Draft Checkout Error]:", error);
    return json(
      {
        success: false,
        error: error?.message || "Internal server error occurred while creating checkout.",
      },
      { status: 500, headers: corsHeaders }
    );
  }
};

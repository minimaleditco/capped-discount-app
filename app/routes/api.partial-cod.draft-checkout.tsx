import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  normalizeShopDomain,
  validateVerificationToken,
  logAudit,
} from "../db.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";
import { calculateDraftPricing } from "../services/draft-pricing.server";
import { allocateProportionally, type RawLineItem } from "../services/pricing.server";

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
            "Store authorization required: Please open the 'Partio' app in your Shopify Admin once to authenticate.",
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

    const requestedCode = String(body.couponCode || "").trim();

    // Shopify calculates the cart: automatic discounts, product scope,
    // quantity conditions and stacking rules all come from Shopify itself.
    const pricing = await calculateDraftPricing(admin, rawItems, requestedCode);
    if (!pricing.ok) {
      return json(
        { success: false, error: pricing.error || "Unable to price this order." },
        { status: 400, headers: corsHeaders }
      );
    }

    const lines = pricing.lines;
    const subtotal = pricing.catalogSubtotal;
    const currencyCode = pricing.currencyCode;
    const effectiveTotalPrice = pricing.discountedSubtotal;
    const appliedDiscount = pricing.totalDiscount;
    const couponCode = pricing.appliedCodes[0] || "";
    const discountSource = couponCode ? `code ${couponCode}` : "Shopify discount";

    // Every amount written to the draft order is formatted in the store's own
    // currency. Hard-coded rupee symbols made USD/EUR orders look wrong even
    // when the numbers were correct.
    const fmtMoney = (value: number) => {
      try {
        return new Intl.NumberFormat("en", {
          style: "currency",
          currency: currencyCode,
        }).format(value);
      } catch {
        return `${currencyCode} ${Number(value).toFixed(2)}`;
      }
    };

    if (subtotal <= 0) {
      return json(
        { success: false, error: "This cart has no payable value." },
        { status: 400, headers: corsHeaders }
      );
    }

    const isPrepaid = body.isPrepaid === true;
    const settings = await getPartialCodSettings(shop);



    // ---------------------------------------------------------------------
    // 4. Verify WhatsApp / SMS OTP for COD orders only.
    // ---------------------------------------------------------------------
    const customerPhone = String(body.phone || body.customerPhone || "").replace(/[^0-9]/g, "");
    const otpToken = String(body.otpToken || body.token || "").trim();
    const deliveryPincode = String(body.pincode || body.shippingAddress?.zip || "")
      .replace(/[^0-9a-zA-Z]/g, "")
      .slice(0, 10);
    const marketingConsent =
      body.marketingConsent === true
        ? "granted"
        : body.marketingConsent === false
        ? "denied"
        : "unknown";

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
        pincode: deliveryPincode,
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
    // Spread the deposit across lines in proportion to what each line costs
    // *after* Shopify's discounts, so the invoice mirrors the real order.
    const shares = allocateProportionally(
      onlineAmount,
      lines.map((line) => ({ lineTotal: line.discountedLineTotal || line.lineTotal }))
    );

    // Order-level context is attached to the first line only: Shopify renders
    // line-item attributes under each product on the invoice, so repeating the
    // deposit/balance on every line would be noise.
    const orderContextAttributes: { key: string; value: string }[] = [];
    if (appliedDiscount > 0) {
      orderContextAttributes.push({
        key: "Discount Applied",
        value: `-${fmtMoney(appliedDiscount)} (${discountSource})`,
      });
    }
    if (isPrepaid) {
      orderContextAttributes.push({
        key: "Payment",
        value: `Paid in full online: ${fmtMoney(onlineAmount)}`,
      });
    } else {
      orderContextAttributes.push(
        { key: "Pay Now (Advance Deposit)", value: fmtMoney(onlineAmount) },
        { key: "Balance Due on Delivery (Cash)", value: fmtMoney(balance) }
      );
      if (deliveryPincode) {
        orderContextAttributes.push({ key: "Delivery Pincode", value: deliveryPincode });
      }
    }

    orderContextAttributes.push({ key: "Marketing Consent", value: marketingConsent });

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
          { key: "Catalog Unit Price", value: fmtMoney(line.unitPrice) },
          { key: "Net Product Total", value: fmtMoney(line.lineTotal) },
          ...(index === 0 ? orderContextAttributes : []),
        ],
      };
    });

    const tags: string[] = isPrepaid
      ? [
          "Prepaid",
          "Paid Online",
          `Total Paid Online: ${fmtMoney(onlineAmount)}`,
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ${fmtMoney(appliedDiscount)}`] : []),
        ]
      : [
          "Partially Paid",
          "Partial COD",
          `Deposit Paid: ${fmtMoney(onlineAmount)}`,
          `Doorstep Balance: ${fmtMoney(balance)}`,
          `Collect ${fmtMoney(balance)} on Delivery`,
          matchedRuleType ? `Rule: ${matchedRuleType}` : "Rule: Store Default",
          ...(deliveryPincode ? [`Pincode: ${deliveryPincode}`] : []),
          ...(customerPhone ? [`SMS Verified: +91${customerPhone}`] : []),
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ${fmtMoney(appliedDiscount)}`] : []),
        ];

    const discountNoteLine =
      appliedDiscount > 0
        ? `\n• Discount Applied: -${fmtMoney(appliedDiscount)} (${discountSource})`
        : "";

    if (appliedDiscount > 0) {
      tags.push(
        couponCode ? `Coupon: ${couponCode}` : "Automatic Discount",
        `Discount: ${fmtMoney(appliedDiscount)}`
      );
    } else {
      tags.push("No Discount");
    }

    const note = isPrepaid
      ? `[FULL PREPAID ORDER] • Amount Paid: ${fmtMoney(onlineAmount)}${
          couponCode ? `\n• Coupon Applied: ${couponCode} (-${fmtMoney(appliedDiscount)})` : ""
        }${discountNoteLine}`
      : `[PARTIALLY PAID] • Advance Deposit (Paid Online): ${fmtMoney(onlineAmount)}\n• Remaining COD Balance (To Collect in Cash at Doorstep): ${fmtMoney(balance)}\n• Dynamic Rule: ${ruleSummary}${
          couponCode ? `\n• Coupon Applied: ${couponCode} (-${fmtMoney(appliedDiscount)})` : ""
        }${discountNoteLine}${customerPhone ? `\n• Verified Mobile (SMS): +91${customerPhone}` : ""}`;

    const customAttributes = isPrepaid
      ? [
          { key: "Payment Type", value: "Prepaid Online" },
          { key: "Prepaid Total Paid", value: fmtMoney(onlineAmount) },
          ...(couponCode
            ? [
                { key: "Coupon Code", value: couponCode },
                { key: "Coupon Discount", value: fmtMoney(appliedDiscount) },
              ]
            : []),
          { key: "Order Subtotal (Verified)", value: fmtMoney(subtotal) },
          { key: "single_coupon_policy_enforced", value: "true" },
        ]
      : [
          { key: "Payment Status", value: "Partially Paid" },
          { key: "Advance Deposit Paid", value: fmtMoney(onlineAmount) },
          { key: "Doorstep COD Balance Due", value: fmtMoney(balance) },
          { key: "Order Subtotal (Verified)", value: fmtMoney(subtotal) },
          ...(customerPhone ? [{ key: "Verified Mobile", value: customerPhone }] : []),
          ...(couponCode
            ? [
                { key: "Coupon Code", value: couponCode },
                { key: "Coupon Discount", value: fmtMoney(appliedDiscount) },
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
      appliedDiscount,
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
          // The shopper approved an exact deposit in the popup. Taxes depend on
          // the address entered later in checkout, so letting Shopify add them
          // here would charge more than the quoted amount. The doorstep balance
          // settles the rest of the order.
          taxExempt: true,
          // A second code at the deposit checkout would undercut the quote.
          allowDiscountCodesInCheckout: false,
        },
      },
    });

    const resJson: any = await response.json();

    if (resJson.data?.draftOrderCreate?.userErrors?.length > 0) {
      const errMsg = resJson.data.draftOrderCreate.userErrors.map((e: any) => e.message).join(", ");
      return json({ success: false, error: errMsg }, { status: 400, headers: corsHeaders });
    }

    const draftOrder = resJson.data?.draftOrderCreate?.draftOrder;
    if (draftOrder?.invoiceUrl) {
      await logAudit(shop, "draft_checkout.create", draftOrder.name || "");
    }
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
        appliedDiscount,
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

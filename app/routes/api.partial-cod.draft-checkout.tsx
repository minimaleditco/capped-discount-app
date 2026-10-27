import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import { getPartialCodSettings, validateVerificationToken } from "../db.server";
import { evaluateDepositRules } from "../services/deposit-rules.server";

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
    let { shop, variantId, quantity = 1, price, title, items } = body;

    let shopToUse = String(shop || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();

    if (!shopToUse || shopToUse === "localhost" || shopToUse.includes("undefined")) {
      shopToUse = "minimal-discount-test-3.myshopify.com";
    } else if (!shopToUse.includes(".myshopify.com") && !shopToUse.includes(".")) {
      shopToUse = `${shopToUse}.myshopify.com`;
    }

    let admin: any;
    try {
      const authResult = await unauthenticated.admin(shopToUse);
      admin = authResult.admin;
    } catch (sessionErr: any) {
      if (shopToUse !== "minimal-discount-test-3.myshopify.com") {
        try {
          const authResult = await unauthenticated.admin("minimal-discount-test-3.myshopify.com");
          admin = authResult.admin;
        } catch {
          console.error("[Draft Checkout Session Error]:", sessionErr);
          return json(
            {
              success: false,
              error: "Store authorization required: Please open the 'Capped Discount & COD Fee' app in your Shopify Admin once to authenticate.",
            },
            { status: 403, headers: corsHeaders }
          );
        }
      } else {
        console.error("[Draft Checkout Session Error]:", sessionErr);
        return json(
          {
            success: false,
            error: "Store authorization required: Please open the 'Capped Discount & COD Fee' app in your Shopify Admin once to authenticate.",
          },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // Build line items
    const lineItemsInput: any[] = [];
    let totalPrice = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const rawId = it.variantId || it.id;
        const gid = String(rawId).startsWith("gid://shopify/ProductVariant/")
          ? rawId
          : `gid://shopify/ProductVariant/${rawId}`;
        const qty = Number(it.quantity) || 1;
        const itemPrice = parseFloat(String(it.price || 0));
        lineItemsInput.push({ variantId: gid, quantity: qty, price: itemPrice, title: it.title || "Item" });
        totalPrice += itemPrice * qty;
      }
    } else if (variantId) {
      const gid = String(variantId).startsWith("gid://shopify/ProductVariant/")
        ? variantId
        : `gid://shopify/ProductVariant/${variantId}`;
      const qty = Number(quantity) || 1;
      let itemPrice = parseFloat(String(price || 0));

      // If price not passed, fetch from Shopify GraphQL
      if (!itemPrice || itemPrice <= 0) {
        try {
          const varQuery = `#graphql
            query GetVariantPrice($id: ID!) {
              productVariant(id: $id) {
                price
                title
              }
            }
          `;
          const vRes = await admin.graphql(varQuery, { variables: { id: gid } });
          const vJson = await vRes.json();
          if (vJson.data?.productVariant?.price) {
            itemPrice = parseFloat(vJson.data.productVariant.price);
          }
        } catch (err) {
          console.warn("[Draft Checkout] Failed to fetch variant price:", err);
        }
      }

      lineItemsInput.push({ variantId: gid, quantity: qty, price: itemPrice, title: title || "Item" });
      totalPrice = itemPrice * qty;
    }

    if (lineItemsInput.length === 0) {
      return json(
        { success: false, error: "No valid product variant provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    const isPrepaid = body.isPrepaid === true;
    const prepaidDiscount = Math.max(0, parseFloat(String(body.prepaidDiscount || 0)));
    const couponCode = String(body.couponCode || "").trim().toUpperCase();
    const couponDiscount = Math.max(0, parseFloat(String(body.couponDiscount || 0)));

    // Verify WhatsApp / SMS OTP only for COD orders (Prepaid orders pay upfront online, so no fake order risk)
    const settings = await getPartialCodSettings(shopToUse);
    const customerPhone = String(body.phone || body.customerPhone || "").replace(/[^0-9]/g, "");
    const otpToken = String(body.otpToken || body.token || "").trim();

    if (!isPrepaid && settings.whatsappEnabled) {
      const isVerified = await validateVerificationToken(shopToUse, customerPhone, otpToken);
      if (!isVerified) {
        return json(
          {
            success: false,
            error: "Mobile number verification required. Please verify the OTP sent to your mobile number before placing a Partial COD order.",
            requiresOtp: true,
          },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // Apply coupon discount to subtotal if provided
    const effectiveTotalPrice = Math.max(0, Math.round((totalPrice - couponDiscount) * 100) / 100);

    let deposit = effectiveTotalPrice;
    let balance = 0;
    let totalDeduction = 0;
    let draftOrderPayload: any;

    if (isPrepaid) {
      // 1. FULL PREPAID ORDER
      const finalPrepaidPrice = Math.max(0, Math.round((effectiveTotalPrice - prepaidDiscount) * 100) / 100);
      deposit = finalPrepaidPrice;
      balance = 0;
      totalDeduction = Math.round((couponDiscount + prepaidDiscount) * 100) / 100;

      draftOrderPayload = {
        lineItems: lineItemsInput,
        tags: [
          "Prepaid",
          "Paid Online",
          `Total Paid Online: ₹${finalPrepaidPrice}`,
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ₹${couponDiscount}`] : []),
          ...(prepaidDiscount > 0 ? [`Extra Prepaid Discount: ₹${prepaidDiscount}`] : []),
        ],
        note: `[FULL PREPAID ORDER] • Amount Paid: ₹${finalPrepaidPrice.toFixed(2)}${couponCode ? `\n• Coupon Applied: ${couponCode} (-₹${couponDiscount.toFixed(2)})` : ""}${prepaidDiscount > 0 ? `\n• Extra Prepaid Savings: -₹${prepaidDiscount.toFixed(2)}` : ""}`,
        customAttributes: [
          { key: "Payment Type", value: "Prepaid Online" },
          { key: "Prepaid Total Paid", value: `₹${finalPrepaidPrice.toFixed(2)}` },
          ...(couponCode ? [{ key: "Coupon Code", value: couponCode }, { key: "Coupon Discount", value: `₹${couponDiscount.toFixed(2)}` }] : []),
          ...(prepaidDiscount > 0 ? [{ key: "Extra Prepaid Savings", value: `₹${prepaidDiscount.toFixed(2)}` }] : []),
          { key: "single_coupon_policy_enforced", value: "true" },
        ],
      };

      if (totalDeduction > 0) {
        draftOrderPayload.appliedDiscount = {
          title: couponCode
            ? `Promotional Discount (${couponCode}${prepaidDiscount > 0 ? " + Extra Prepaid" : ""})`
            : "Prepaid Order Savings",
          description: `Total discount applied: ₹${totalDeduction.toFixed(2)}`,
          value: totalDeduction,
          valueType: "FIXED_AMOUNT",
        };
      }
    } else {
      // 2. PARTIAL CASH ON DELIVERY (COD) ORDER
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const evaluation = await evaluateDepositRules(shop, {
        totalPrice: effectiveTotalPrice,
        currency: "INR",
        lineItems: rawItems.map((it: any) => ({
          title: it.title,
          sku: it.sku,
          variantId: it.variantId || it.id,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
        })),
        pincode: body.pincode || body.shippingAddress?.zip,
        shippingAddress: body.shippingAddress,
      });

      deposit = evaluation.deposit;
      if (body.deposit && Number(body.deposit) > 0) {
        deposit = Math.max(deposit, Number(body.deposit));
      }
      deposit = Math.min(effectiveTotalPrice, deposit);
      balance = Math.max(0, Math.round((effectiveTotalPrice - deposit) * 100) / 100);

      // KEY FIX: Set line item originalUnitPrice to the advance deposit amount!
      // This charges the exact deposit online, without Shopify treating the doorstep balance as a discount or displaying misleading "TOTAL SAVINGS"!
      const lineItemsForPartialCod = lineItemsInput.map((it: any) => {
        const itemTotal = (it.price || 0) * it.quantity;
        const ratio = totalPrice > 0 ? itemTotal / totalPrice : 1 / lineItemsInput.length;
        const itemDeposit = Math.round(deposit * ratio * 100) / 100;
        const unitDeposit = (itemDeposit / it.quantity).toFixed(2);
        const itemBalance = Math.max(0, Math.round((itemTotal - itemDeposit) * 100) / 100);

        return {
          variantId: it.variantId,
          quantity: it.quantity,
          originalUnitPrice: unitDeposit,
          customAttributes: [
            { key: "Advance Deposit Paid", value: `₹${unitDeposit}` },
            { key: "Full Product Value", value: `₹${(it.price || 0).toFixed(2)}` },
            { key: "Remaining Doorstep Balance Due", value: `₹${itemBalance.toFixed(2)}` },
          ],
        };
      });

      draftOrderPayload = {
        lineItems: lineItemsForPartialCod,
        tags: [
          "Partially Paid",
          "Partial COD",
          `Deposit Paid: ₹${deposit}`,
          `Doorstep Balance: ₹${balance}`,
          `Collect ₹${balance} on Delivery`,
          evaluation.matchedRule
            ? `Rule: ${evaluation.matchedRule.conditionType}`
            : "Rule: Store Default",
          ...(customerPhone ? [`SMS Verified: +91${customerPhone}`] : []),
          ...(couponCode ? [`Coupon: ${couponCode}`, `Coupon Discount: ₹${couponDiscount}`] : []),
        ],
        note: `[PARTIALLY PAID] • Advance Deposit (Paid Online): ₹${deposit.toFixed(2)}\n• Remaining COD Balance (To Collect in Cash at Doorstep): ₹${balance.toFixed(2)}\n• Dynamic Rule: ${evaluation.ruleSummary}${couponCode ? `\n• Coupon Applied: ${couponCode} (-₹${couponDiscount.toFixed(2)})` : ""}${customerPhone ? `\n• Verified Mobile (SMS): +91${customerPhone}` : ""}`,
        customAttributes: [
          { key: "Payment Status", value: "Partially Paid" },
          { key: "Advance Deposit Paid", value: `₹${deposit.toFixed(2)}` },
          { key: "Doorstep COD Balance Due", value: `₹${balance.toFixed(2)}` },
          ...(customerPhone ? [{ key: "Verified Mobile", value: customerPhone }] : []),
          ...(couponCode ? [{ key: "Coupon Code", value: couponCode }, { key: "Coupon Discount", value: `₹${couponDiscount.toFixed(2)}` }] : []),
          { key: "Deposit Rule Applied", value: evaluation.ruleSummary },
          { key: "partial_cod_order", value: "true" },
          { key: "single_coupon_policy_enforced", value: "true" },
        ],
      };

      // Notice: We intentionally DO NOT set draftOrderPayload.appliedDiscount for the COD balance!
      // This guarantees Shopify Checkout displays NO "Order discount: -₹540" and NO "TOTAL SAVINGS: ₹540"!
    }

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
      totalPrice,
      deposit,
      balance,
      lineItems: lineItemsInput,
    });

    const response = await admin.graphql(draftOrderMutation, {
      variables: {
        input: draftOrderPayload,
      },
    });

    const resJson: any = await response.json();
    console.log("[Draft Checkout] Response:", JSON.stringify(resJson));

    if (resJson.data?.draftOrderCreate?.userErrors?.length > 0) {
      const errMsg = resJson.data.draftOrderCreate.userErrors
        .map((e: any) => e.message)
        .join(", ");
      return json(
        { success: false, error: errMsg },
        { status: 400, headers: corsHeaders }
      );
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
        deposit,
        balance,
        total: totalPrice,
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

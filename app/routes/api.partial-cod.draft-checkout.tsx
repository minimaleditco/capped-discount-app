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
        lineItemsInput.push({ variantId: gid, quantity: qty });
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

      lineItemsInput.push({ variantId: gid, quantity: qty });
      totalPrice = itemPrice * qty;
    }

    if (lineItemsInput.length === 0) {
      return json(
        { success: false, error: "No valid product variant provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify WhatsApp OTP if enabled
    const settings = await getPartialCodSettings(shopToUse);
    const customerPhone = String(body.phone || body.customerPhone || "").replace(/[^0-9]/g, "");
    const otpToken = String(body.otpToken || body.token || "").trim();
    const couponCode = String(body.couponCode || "").trim().toUpperCase();
    const couponDiscount = Math.max(0, parseFloat(String(body.couponDiscount || 0)));

    if (settings.whatsappEnabled) {
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

    // Determine dynamic risk-based deposit and remaining balance
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

    let deposit = evaluation.deposit;
    if (body.deposit && Number(body.deposit) > 0) {
      deposit = Math.max(deposit, Number(body.deposit));
    }
    // Ensure deposit does not exceed effective total
    deposit = Math.min(effectiveTotalPrice, deposit);
    const balance = Math.max(0, Math.round((effectiveTotalPrice - deposit) * 100) / 100);

    const draftOrderPayload: any = {
      lineItems: lineItemsInput,
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
      ],
    };

    // Apply the remaining balance as a deduction discount so checkout charges ONLY the deposit
    if (balance > 0) {
      draftOrderPayload.appliedDiscount = {
        title: "COD Balance due on Delivery (Doorstep)",
        description: `Pay ₹${deposit} online now. Remaining ₹${balance} collected in cash upon delivery.`,
        value: balance,
        valueType: "FIXED_AMOUNT",
      };
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

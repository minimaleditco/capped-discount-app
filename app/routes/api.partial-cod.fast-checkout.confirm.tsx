import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  getPartialCodSettings,
  saveDeposit,
  type PartialCodDepositRecord,
} from "../db.server";
import { getGatewayAdapter } from "../services/gateways";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { shop, paymentDetails, orderDetails } = body;

    if (!shop || !paymentDetails || !orderDetails) {
      return json(
        { success: false, error: "Missing required parameters: shop, paymentDetails, and orderDetails" },
        { status: 400, headers: corsHeaders }
      );
    }

    const settings = getPartialCodSettings(shop);
    if (!settings.enabled) {
      return json({ success: false, error: "Partial COD is not enabled on this store" }, { status: 400, headers: corsHeaders });
    }

    // 1. Verify Payment via Gateway Adapter
    const adapter = getGatewayAdapter(settings.gateway);
    const isValid = await adapter.verifyPayment({
      shop,
      orderId: paymentDetails.orderId || "unknown",
      gatewayPaymentId: paymentDetails.paymentId || "mock_payment",
      gatewayOrderId: paymentDetails.orderId,
      gatewaySignature: paymentDetails.signature,
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
    });
    if (!isValid) {
      return json({ success: false, error: "Payment verification failed" }, { status: 400, headers: corsHeaders });
    }

    const depositAmount = Number(orderDetails.deposit) || 100;
    const balanceAmount = Number(orderDetails.balance) || 0;
    const totalAmount = Number(orderDetails.total) || depositAmount + balanceAmount;
    const currency = orderDetails.currency || "INR";

    // 2. Create the Order in Shopify Admin as PARTIALLY_PAID
    let admin: any;
    try {
      const authResult = await unauthenticated.admin(shop);
      admin = authResult.admin;
    } catch (sessionErr: any) {
      console.error("[Fast Checkout Session Error]:", sessionErr);
      return json(
        {
          success: false,
          error: "Store permissions need a quick sync: Please open the 'Capped Discount & COD Fee' app in your Shopify Admin once to authenticate, then place the order again.",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const lineItemsInput: any[] = [];
    if (Array.isArray(orderDetails.items) && orderDetails.items.length > 0) {
      for (const item of orderDetails.items) {
        const lineItem: any = {
          quantity: Number(item.quantity) || 1,
        };
        if (item.variantId && String(item.variantId).startsWith("gid://shopify/ProductVariant/")) {
          lineItem.variantId = item.variantId;
        } else if (item.variantId && !isNaN(Number(item.variantId))) {
          lineItem.variantId = `gid://shopify/ProductVariant/${item.variantId}`;
        }
        if (lineItem.variantId) {
          lineItemsInput.push(lineItem);
        }
      }
    }

    if (lineItemsInput.length === 0) {
      return json(
        { success: false, error: "No valid product variant specified for this order." },
        { status: 400, headers: corsHeaders }
      );
    }

    const customerInput = {
      firstName: (orderDetails.customer?.firstName || "Customer").trim(),
      lastName: (orderDetails.customer?.lastName || "").trim() || "Shopper",
      email: orderDetails.customer?.email || `${(orderDetails.customer?.phone || "order").replace(/[^0-9]/g, "") || Date.now()}@customer.placeholder`,
      phone: orderDetails.customer?.phone ? String(orderDetails.customer.phone).trim() : undefined,
    };

    const shippingAddressInput: any = {
      firstName: orderDetails.shippingAddress?.firstName || customerInput.firstName,
      lastName: (orderDetails.shippingAddress?.lastName || customerInput.lastName).trim() || "Shopper",
      address1: orderDetails.shippingAddress?.address1 || "Main Street",
      city: orderDetails.shippingAddress?.city || "New Delhi",
      province: orderDetails.shippingAddress?.province || "Delhi",
      countryCode: "IN",
      zip: orderDetails.shippingAddress?.zip || "110001",
    };
    if (customerInput.phone) {
      shippingAddressInput.phone = customerInput.phone;
    }

    const orderCreateMutation = `#graphql
      mutation OrderCreate($order: OrderCreateOrderInput!) {
        orderCreate(order: $order) {
          order {
            id
            name
            displayFinancialStatus
            totalOutstandingSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const gatewayName = settings.gateway === "razorpay" ? "Razorpay UPI" : "Partial COD (Simulator)";

    const orderPayload: any = {
      financialStatus: "PARTIALLY_PAID",
      tags: ["partial-cod-deposit-paid", "partial-cod-fast-checkout"],
      note: `[Partial COD Fast Checkout] ₹${depositAmount} advance deposit paid via ${gatewayName}. Remaining COD balance to collect at doorstep: ₹${balanceAmount}.`,
      lineItems: lineItemsInput,
      email: customerInput.email,
      shippingAddress: shippingAddressInput,
      billingAddress: shippingAddressInput,
      transactions: [
        {
          kind: "SALE",
          status: "SUCCESS",
          gateway: gatewayName,
          amountSet: {
            shopMoney: {
              amount: depositAmount.toFixed(2),
              currencyCode: currency,
            },
          },
        },
      ],
      customAttributes: [
        { key: "partial_cod_deposit_paid", value: String(depositAmount) },
        { key: "partial_cod_balance_due", value: String(balanceAmount) },
        { key: "partial_cod_gateway", value: settings.gateway },
        { key: "customer_phone", value: String(customerInput.phone || "") },
      ],
    };

    if (customerInput.phone && /^\+[1-9]\d{7,14}$/.test(customerInput.phone)) {
      orderPayload.phone = customerInput.phone;
    }

    const response = await admin.graphql(orderCreateMutation, {
      variables: {
        order: orderPayload,
      },
    });

    const responseJson: any = await response.json();
    console.log("[Fast Checkout orderCreate response]:", JSON.stringify(responseJson));

    if (responseJson.errors && responseJson.errors.length > 0) {
      console.error("[Fast Checkout orderCreate GraphQL Errors]:", responseJson.errors);
      return json({
        success: false,
        error: responseJson.errors.map((e: any) => e.message).join(", "),
      }, { status: 400, headers: corsHeaders });
    }

    const result = responseJson.data?.orderCreate;

    if (result?.userErrors && result.userErrors.length > 0) {
      console.error("[Fast Checkout orderCreate userErrors]:", result.userErrors);
      return json({
        success: false,
        error: result.userErrors.map((e: any) => e.message).join(", "),
      }, { status: 400, headers: corsHeaders });
    }

    const createdOrder = result?.order;
    if (!createdOrder) {
      return json({ success: false, error: "Failed to create order in Shopify" }, { status: 500, headers: corsHeaders });
    }

    // 3. Persist the deposit record in SQLite
    const depositRecord: PartialCodDepositRecord = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      shop,
      orderId: createdOrder.id,
      orderName: createdOrder.name,
      totalAmount,
      depositAmount,
      remainingBalance: balanceAmount,
      currency,
      status: "paid",
      gateway: settings.gateway,
      gatewayTransactionId: paymentDetails.paymentId || "mock_payment_id",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveDeposit(depositRecord);

    return json({
      success: true,
      orderId: createdOrder.id,
      orderName: createdOrder.name,
      depositAmount,
      remainingBalance: balanceAmount,
      currency,
      message: `Deposit of ₹${depositAmount} captured! Order ${createdOrder.name} confirmed.`,
    }, {
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("[Fast Checkout Confirm Error]:", error);
    return json({ success: false, error: error.message || "Failed to confirm fast checkout" }, { status: 500, headers: corsHeaders });
  }
};

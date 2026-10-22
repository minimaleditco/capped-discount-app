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
    const { admin } = await unauthenticated.admin(shop);

    const lineItemsInput = (orderDetails.items || []).map((item: any) => {
      const lineItem: any = {
        quantity: Number(item.quantity) || 1,
      };
      if (item.variantId && item.variantId.startsWith("gid://shopify/ProductVariant/")) {
        lineItem.variantId = item.variantId;
      } else if (item.variantId) {
        lineItem.variantId = `gid://shopify/ProductVariant/${item.variantId}`;
      } else {
        lineItem.title = item.title || "Custom Item";
        lineItem.price = String(item.price || "100.00");
      }
      return lineItem;
    });

    const customerInput = {
      firstName: orderDetails.customer?.firstName || "Customer",
      lastName: orderDetails.customer?.lastName || "",
      email: orderDetails.customer?.email || `${orderDetails.customer?.phone || "order"}@customer.placeholder`,
      phone: orderDetails.customer?.phone || undefined,
    };

    const shippingAddressInput = {
      firstName: orderDetails.shippingAddress?.firstName || customerInput.firstName,
      lastName: orderDetails.shippingAddress?.lastName || customerInput.lastName,
      address1: orderDetails.shippingAddress?.address1 || "Main Street",
      city: orderDetails.shippingAddress?.city || "New Delhi",
      province: orderDetails.shippingAddress?.province || "Delhi",
      country: orderDetails.shippingAddress?.country || "India",
      zip: orderDetails.shippingAddress?.zip || "110001",
      phone: orderDetails.shippingAddress?.phone || customerInput.phone,
    };

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

    const orderPayload = {
      financialStatus: "PARTIALLY_PAID",
      tags: ["partial-cod-deposit-paid", "partial-cod-fast-checkout"],
      note: `[Partial COD Fast Checkout] ₹${depositAmount} advance deposit paid via ${gatewayName}. Remaining COD balance to collect at doorstep: ₹${balanceAmount}.`,
      lineItems: lineItemsInput,
      customer: customerInput,
      shippingAddress: shippingAddressInput,
      billingAddress: shippingAddressInput,
      transactions: [
        {
          kind: "CAPTURE",
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
      ],
    };

    const response = await admin.graphql(orderCreateMutation, {
      variables: {
        order: orderPayload,
      },
    });

    const responseJson = await response.json();
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

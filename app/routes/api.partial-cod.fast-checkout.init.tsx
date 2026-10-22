import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getPartialCodSettings } from "../db.server";
import { getGatewayAdapter } from "../services/gateways";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleInit(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleInit(request);
};

async function handleInit(request: Request) {
  try {
    let body: any = {};
    if (request.method === "POST") {
      try {
        body = await request.json();
      } catch {
        // empty or not JSON
      }
    } else {
      const url = new URL(request.url);
      body.shop = url.searchParams.get("shop");
    }

    const shop = body.shop;
    if (!shop) {
      return json({ success: false, error: "Missing required parameter: shop" }, { status: 400, headers: corsHeaders });
    }

    const settings = getPartialCodSettings(shop);
    if (!settings.enabled) {
      return json({ success: false, error: "Partial COD is not enabled on this store" }, { status: 400, headers: corsHeaders });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    let subtotal = 0;
    for (const item of items) {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 1;
      subtotal += price * qty;
    }

    // Default to at least item price if not specified
    if (subtotal <= 0 && body.total) {
      subtotal = Number(body.total) || 1000;
    }
    if (subtotal <= 0) {
      subtotal = 1000;
    }

    // Check discount
    let discount = Number(body.discount) || 0;
    let shipping = Number(body.shipping) || 0;
    let total = Math.max(0, subtotal - discount + shipping);

    // Calculate deposit
    let deposit = 100;
    if (settings.depositType === "percentage") {
      deposit = Math.round((total * (Number(settings.depositValue) || 10)) / 100);
    } else {
      deposit = Math.min(total, Number(settings.depositValue) || 100);
    }
    const balance = Math.max(0, total - deposit);

    // Initialize Gateway Session
    const adapter = getGatewayAdapter(settings.gateway);
    const sessionOrderId = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gatewayOrder = await adapter.createPayment({
      shop,
      orderId: sessionOrderId,
      orderName: sessionOrderId,
      depositAmount: deposit,
      currency: "INR",
      apiKey: settings.apiKey,
      apiSecret: settings.apiSecret,
    });

    return json({
      success: true,
      shop,
      settings: {
        enabled: settings.enabled,
        gateway: settings.gateway,
        depositType: settings.depositType,
        depositValue: settings.depositValue,
      },
      subtotal,
      discount,
      shipping,
      total,
      deposit,
      balance,
      currency: "INR",
      gateway: settings.gateway,
      gatewayOrderId: gatewayOrder.gatewayOrderId || sessionOrderId,
      keyId: settings.gateway === "razorpay" ? settings.apiKey : undefined,
    }, {
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("[Fast Checkout Init Error]:", error);
    return json({ success: false, error: error.message || "Failed to initialize fast checkout" }, { status: 500, headers: corsHeaders });
  }
}

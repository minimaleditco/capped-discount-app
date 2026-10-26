import crypto from "node:crypto";
import { getPartialCodSettings } from "../db.server";

export interface OrderCapiData {
  orderId: string | number;
  orderName?: string;
  currency: string;
  fullValue: number;
  depositValue?: number;
  balanceValue?: number;
  createdAt?: string | number | Date;
  customer?: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string | null;
  };
  clientIp?: string | null;
  userAgent?: string | null;
  lineItems?: Array<{
    id?: string | number;
    sku?: string;
    title?: string;
    quantity: number;
    price: number;
  }>;
}

export interface MetaCapiResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  eventsReceived?: number;
  fbtraceId?: string;
  error?: string;
}

/**
 * Normalizes and computes SHA-256 hash according to Meta CAPI specification
 */
export function hashSha256(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = String(value).trim().toLowerCase();
  if (!cleaned) return undefined;
  return crypto.createHash("sha256").update(cleaned).digest("hex");
}

/**
 * Normalizes telephone number to E.164 and computes SHA-256 hash
 */
export function hashPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  // If standard 10-digit mobile number, prepend Indian country code 91
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return crypto.createHash("sha256").update(digits).digest("hex");
}

/**
 * Dispatches a Purchase conversion event to Meta Conversions API (Graph API v19.0).
 * Accurately reports full cart value (Deposit + Doorstep Balance) to prevent
 * ROAS degradation and distorted Meta algorithmic bidding on draft orders.
 */
export async function sendToMetaCAPI(
  shop: string,
  orderData: OrderCapiData,
  options?: { testEventCode?: string }
): Promise<MetaCapiResult> {
  const settings = await getPartialCodSettings(shop);

  const pixelId = (settings.metaPixelId || "").trim();
  const accessToken = (settings.metaCapiToken || "").trim();

  if (!pixelId || !accessToken) {
    console.log(
      `[Meta CAPI] Skipping dispatch for ${shop}: Meta Pixel ID or CAPI Access Token not configured.`
    );
    return {
      success: false,
      skipped: true,
      reason: "Meta Pixel ID or CAPI Access Token not configured in store settings.",
    };
  }

  // Determine event timestamp
  let eventTime = Math.floor(Date.now() / 1000);
  if (orderData.createdAt) {
    const parsed = new Date(orderData.createdAt);
    if (!isNaN(parsed.getTime())) {
      eventTime = Math.floor(parsed.getTime() / 1000);
    }
  }

  // Format hashed customer user data
  const userData: Record<string, any> = {};
  const emailHash = hashSha256(orderData.customer?.email);
  if (emailHash) userData.em = [emailHash];

  const phoneHash = hashPhone(orderData.customer?.phone);
  if (phoneHash) userData.ph = [phoneHash];

  const fnHash = hashSha256(orderData.customer?.firstName);
  if (fnHash) userData.fn = [fnHash];

  const lnHash = hashSha256(orderData.customer?.lastName);
  if (lnHash) userData.ln = [lnHash];

  const cityHash = hashSha256(orderData.customer?.city);
  if (cityHash) userData.ct = [cityHash];

  const zipHash = hashSha256(
    orderData.customer?.zip ? String(orderData.customer.zip).replace(/[^a-zA-Z0-9]/g, "") : ""
  );
  if (zipHash) userData.zp = [zipHash];

  const countryHash = hashSha256(
    orderData.customer?.country ? String(orderData.customer.country).slice(0, 2) : "in"
  );
  if (countryHash) userData.country = [countryHash];

  if (orderData.clientIp) userData.client_ip_address = orderData.clientIp;
  if (orderData.userAgent) userData.client_user_agent = orderData.userAgent;

  // Format line item contents
  const contents = (orderData.lineItems || []).map((item) => ({
    id: item.sku || String(item.id || "item"),
    quantity: Number(item.quantity) || 1,
    item_price: Number(item.price) || 0,
    title: item.title,
  }));

  const totalQuantity = contents.reduce((sum, item) => sum + item.quantity, 0);

  // Construct Meta CAPI event payload
  const eventPayload: Record<string, any> = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: `shopify_order_${orderData.orderId}`,
        event_source_url: `https://${shop}`,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: (orderData.currency || "INR").toUpperCase(),
          value: Math.round(Number(orderData.fullValue) * 100) / 100,
          content_type: "product",
          contents,
          num_items: totalQuantity,
          order_id: String(orderData.orderId),
          order_name: orderData.orderName || undefined,
          deposit_paid: orderData.depositValue,
          doorstep_balance: orderData.balanceValue,
        },
      },
    ],
  };

  const testEventCode = options?.testEventCode || process.env.META_TEST_EVENT_CODE;
  if (testEventCode) {
    eventPayload.test_event_code = testEventCode.trim();
  }

  const endpoint = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;

  try {
    console.log(
      `[Meta CAPI] Dispatching Purchase event for Order ${orderData.orderId} (Full Value: ${orderData.currency} ${orderData.fullValue})...`
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    const responseData: any = await response.json();

    if (!response.ok) {
      const errMsg = responseData?.error?.message || response.statusText;
      console.error(`[Meta CAPI Error] HTTP ${response.status}:`, responseData);
      return {
        success: false,
        error: errMsg,
        fbtraceId: responseData?.error?.fbtrace_id,
      };
    }

    console.log(
      `[Meta CAPI Success] Event received: ${responseData.events_received}, FBTrace: ${responseData.fbtrace_id}`
    );

    return {
      success: true,
      eventsReceived: responseData.events_received,
      fbtraceId: responseData.fbtrace_id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Meta CAPI Exception]:", message);
    return {
      success: false,
      error: message,
    };
  }
}

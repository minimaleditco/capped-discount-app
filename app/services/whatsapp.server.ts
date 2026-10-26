import { getPartialCodSettings } from "../db.server";

export interface WhatsAppSendResult {
  success: boolean;
  provider: "simulator" | "interakt" | "twilio";
  messageId?: string;
  error?: string;
}

export interface DunningMessageData {
  orderName: string;
  balanceAmount: number;
  currency: string;
}

/**
 * Normalizes phone numbers for WhatsApp dispatch.
 * Prepends Indian country code 91 if a 10-digit mobile number is supplied.
 */
export function formatWhatsAppPhone(rawPhone: string): { countryCode: string; nationalNumber: string; fullPhone: string } {
  let digits = String(rawPhone || "").replace(/[^0-9]/g, "");

  if (digits.length === 10) {
    return {
      countryCode: "+91",
      nationalNumber: digits,
      fullPhone: "91" + digits,
    };
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return {
      countryCode: "+91",
      nationalNumber: digits.slice(2),
      fullPhone: digits,
    };
  }

  return {
    countryCode: "+91",
    nationalNumber: digits,
    fullPhone: digits,
  };
}

/**
 * Dispatches an OTP verification message via the configured WhatsApp provider
 */
export async function sendWhatsAppOtp(
  shop: string,
  phone: string,
  otp: string
): Promise<WhatsAppSendResult> {
  const settings = await getPartialCodSettings(shop);
  const provider = settings.whatsappProvider || "simulator";
  const { countryCode, nationalNumber, fullPhone } = formatWhatsAppPhone(phone);

  const messageText = `Your Partial COD verification code is: *${otp}*. Valid for 5 minutes. Do not share this code with anyone.`;

  // 1. Simulator Mode (Console Output & Auto-Verify Support)
  if (provider === "simulator" || !settings.whatsappApiKey) {
    console.log(
      `\n======================================================\n` +
      `📱 [WhatsApp SIMULATOR] Dispatching OTP to +${fullPhone}\n` +
      `👉 Code: ${otp}\n` +
      `👉 Message: "${messageText}"\n` +
      `======================================================\n`
    );
    return {
      success: true,
      provider: "simulator",
      messageId: `sim_otp_${Date.now()}`,
    };
  }

  // 2. Interakt WhatsApp API (Standard Indian D2C Provider)
  if (provider === "interakt") {
    try {
      const apiKey = settings.whatsappApiKey.trim();
      const endpoint = "https://api.interakt.ai/v1/public/message/";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber: nationalNumber,
          type: "Template",
          template: {
            name: "partial_cod_otp",
            languageCode: "en",
            bodyValues: [otp],
          },
        }),
      });

      const resData: any = await response.json();
      if (!response.ok || resData?.result === false) {
        console.warn(`[Interakt WhatsApp OTP Error]:`, resData);
        return {
          success: false,
          provider: "interakt",
          error: resData?.message || "Failed to deliver OTP via Interakt",
        };
      }

      return {
        success: true,
        provider: "interakt",
        messageId: resData?.id,
      };
    } catch (err) {
      console.error("[Interakt WhatsApp Exception]:", err);
      return {
        success: false,
        provider: "interakt",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 3. Twilio WhatsApp API
  if (provider === "twilio") {
    try {
      const accountSid = (settings.whatsappApiUrl || "").trim();
      const authToken = settings.whatsappApiKey.trim();
      const sender = settings.whatsappSender || "whatsapp:+14155238886";

      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams();
      params.append("From", sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`);
      params.append("To", `whatsapp:+${fullPhone}`);
      params.append("Body", messageText);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const resData: any = await response.json();
      if (!response.ok) {
        console.warn(`[Twilio WhatsApp OTP Error]:`, resData);
        return {
          success: false,
          provider: "twilio",
          error: resData?.message || "Failed to deliver OTP via Twilio",
        };
      }

      return {
        success: true,
        provider: "twilio",
        messageId: resData?.sid,
      };
    } catch (err) {
      console.error("[Twilio WhatsApp Exception]:", err);
      return {
        success: false,
        provider: "twilio",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: false,
    provider,
    error: `Unsupported WhatsApp provider: ${provider}`,
  };
}

/**
 * Dispatches an automated Out for Delivery courier reminder alerting the customer
 * of the exact cash balance due at doorstep.
 */
export async function sendDunningReminder(
  shop: string,
  phone: string,
  data: DunningMessageData
): Promise<WhatsAppSendResult> {
  const settings = await getPartialCodSettings(shop);
  const provider = settings.whatsappProvider || "simulator";
  const { countryCode, nationalNumber, fullPhone } = formatWhatsAppPhone(phone);

  const formattedAmount = `${data.currency} ${data.balanceAmount.toLocaleString("en-IN")}`;
  const messageText =
    `📦 *Your order ${data.orderName} is Out for Delivery today!*\n\n` +
    `Please keep *${formattedAmount}* ready in cash or UPI to hand to the delivery executive.\n\n` +
    `Thank you for shopping with us!`;

  if (provider === "simulator" || !settings.whatsappApiKey) {
    console.log(
      `\n======================================================\n` +
      `🚚 [WhatsApp SIMULATOR] Out for Delivery Dunning Reminder to +${fullPhone}\n` +
      `👉 Order: ${data.orderName}\n` +
      `👉 COD Balance: ${formattedAmount}\n` +
      `👉 Message: "${messageText}"\n` +
      `======================================================\n`
    );
    return {
      success: true,
      provider: "simulator",
      messageId: `sim_dunning_${Date.now()}`,
    };
  }

  if (provider === "interakt") {
    try {
      const apiKey = settings.whatsappApiKey.trim();
      const endpoint = "https://api.interakt.ai/v1/public/message/";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryCode,
          phoneNumber: nationalNumber,
          type: "Template",
          template: {
            name: "partial_cod_dunning",
            languageCode: "en",
            bodyValues: [data.orderName, formattedAmount],
          },
        }),
      });

      const resData: any = await response.json();
      return {
        success: response.ok,
        provider: "interakt",
        messageId: resData?.id,
        error: response.ok ? undefined : resData?.message,
      };
    } catch (err) {
      return {
        success: false,
        provider: "interakt",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (provider === "twilio") {
    try {
      const accountSid = (settings.whatsappApiUrl || "").trim();
      const authToken = settings.whatsappApiKey.trim();
      const sender = settings.whatsappSender || "whatsapp:+14155238886";

      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams();
      params.append("From", sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`);
      params.append("To", `whatsapp:+${fullPhone}`);
      params.append("Body", messageText);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const resData: any = await response.json();
      return {
        success: response.ok,
        provider: "twilio",
        messageId: resData?.sid,
        error: response.ok ? undefined : resData?.message,
      };
    } catch (err) {
      return {
        success: false,
        provider: "twilio",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    success: false,
    provider,
    error: `Unsupported WhatsApp provider: ${provider}`,
  };
}

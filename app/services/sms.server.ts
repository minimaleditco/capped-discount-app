import { getPartialCodSettings } from "../db.server";

export interface SmsDispatchResult {
  success: boolean;
  provider: "simulator" | "fast2sms" | "twilio";
  messageId?: string;
  error?: string;
  debugOtp?: string;
}

/**
 * Normalizes phone number to 10 digits for Indian carriers and E.164 for international
 */
export function formatPhoneNumber(phone: string): { clean10: string; e164: string } {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  return {
    clean10: cleaned,
    e164: `+91${cleaned}`,
  };
}

/**
 * Dispatches a 6-digit verification OTP code via SMS using Fast2SMS, Twilio, or built-in Simulator
 */
export async function sendSmsOtp(
  shop: string,
  rawPhone: string,
  otp: string
): Promise<SmsDispatchResult> {
  const { clean10, e164 } = formatPhoneNumber(rawPhone);
  const settings = await getPartialCodSettings(shop);

  const provider = settings.smsProvider || (settings.smsApiKey ? "fast2sms" : "simulator");

  // 1. BUILT-IN SIMULATOR MODE
  if (provider === "simulator" || !settings.smsApiKey) {
    console.log("======================================================");
    console.log(`📲 [SMS SIMULATOR] Dispatching OTP to ${e164}`);
    console.log(`🔑 Verification OTP: ${otp}`);
    console.log(`💬 Message: "Your verification code for Partial COD order is ${otp}. Valid for 5 minutes."`);
    console.log("======================================================");

    return {
      success: true,
      provider: "simulator",
      messageId: `sim_sms_${Date.now()}`,
      debugOtp: otp,
    };
  }

  // 2. FAST2SMS (Optimized for India)
  if (provider === "fast2sms") {
    try {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": settings.smsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "otp",
          variables_values: otp,
          numbers: clean10,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.return === true) {
        console.log(`[Fast2SMS OTP Sent] Delivered to ${clean10}, RequestId: ${data.request_id}`);
        return {
          success: true,
          provider: "fast2sms",
          messageId: String(data.request_id || Date.now()),
        };
      }

      console.error("[Fast2SMS Error Response]:", data);
      return {
        success: false,
        provider: "fast2sms",
        error: Array.isArray(data.message) ? data.message.join(", ") : (data.message || "Failed to send SMS via Fast2SMS"),
      };
    } catch (err: any) {
      console.error("[Fast2SMS Network Error]:", err);
      return {
        success: false,
        provider: "fast2sms",
        error: err?.message || "Fast2SMS API connection failed",
      };
    }
  }

  // 3. TWILIO SMS (Global)
  if (provider === "twilio") {
    try {
      const accountSid = settings.whatsappApiUrl || settings.smsSenderId || "";
      const authToken = settings.smsApiKey;
      const senderNumber = settings.whatsappSender || "";

      if (!accountSid || !authToken || !senderNumber) {
        throw new Error("Missing Twilio Account SID, Auth Token, or Sender Number.");
      }

      const bodyParams = new URLSearchParams();
      bodyParams.append("To", e164);
      bodyParams.append("From", senderNumber);
      bodyParams.append("Body", `Your verification code for your Partial COD order is ${otp}. Valid for 5 minutes.`);

      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.sid) {
        return {
          success: true,
          provider: "twilio",
          messageId: data.sid,
        };
      }

      return {
        success: false,
        provider: "twilio",
        error: data.message || "Twilio SMS delivery failed.",
      };
    } catch (err: any) {
      return {
        success: false,
        provider: "twilio",
        error: err?.message || "Twilio API connection failed.",
      };
    }
  }

  return {
    success: false,
    provider: "simulator",
    error: `Unknown SMS provider: ${provider}`,
  };
}

/**
 * Sends an "Out for Delivery" cash reminder via SMS when courier is arriving
 */
export async function sendCourierReminderSms(
  shop: string,
  rawPhone: string,
  data: {
    orderName: string;
    balanceAmount: number;
    currency: string;
  }
): Promise<boolean> {
  const { clean10, e164 } = formatPhoneNumber(rawPhone);
  const settings = await getPartialCodSettings(shop);
  const formattedBalance = `${data.currency} ${data.balanceAmount.toLocaleString("en-IN")}`;
  const message = `Your order ${data.orderName} is Out for Delivery today! Please keep ${formattedBalance} ready in cash for the delivery executive.`;

  const provider = settings.smsProvider || (settings.smsApiKey ? "fast2sms" : "simulator");

  if (provider === "simulator" || !settings.smsApiKey) {
    console.log("======================================================");
    console.log(`🚚 [SMS SIMULATOR] Out for Delivery Reminder to ${e164}`);
    console.log(`👉 Order: ${data.orderName} | COD Balance: ${formattedBalance}`);
    console.log(`👉 Message: "${message}"`);
    console.log("======================================================");
    return true;
  }

  if (provider === "fast2sms") {
    try {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          "authorization": settings.smsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: message,
          language: "english",
          flash: 0,
          numbers: clean10,
        }),
      });
      const resData = await response.json().catch(() => ({}));
      return Boolean(response.ok && resData.return === true);
    } catch {
      return false;
    }
  }

  return false;
}

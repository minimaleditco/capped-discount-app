import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  getPartialCodSettings,
  createOtpSession,
  verifyOtpSession,
} from "../db.server";
import { sendWhatsAppOtp } from "../services/whatsapp.server";
import { sendSmsOtp } from "../services/sms.server";
import { evaluateSendRateLimit, generateOtpCode } from "../services/otp";
import { simulatorAllowed } from "../services/gateways";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

/**
 * In-memory send log, keyed by shop+phone, used to stop SMS-pumping abuse
 * (an attacker spamming /otp/send to burn the merchant's SMS credit).
 * Per-instance only, which is enough to stop the trivial attack; a shared
 * store can replace this later.
 */
const otpSendLog = new Map<string, number[]>();

function pruneSendLog(now: number) {
  for (const [key, stamps] of otpSendLog) {
    const fresh = stamps.filter((t) => now - t < 60 * 60 * 1000);
    if (fresh.length === 0) otpSendLog.delete(key);
    else otpSendLog.set(key, fresh);
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleOtpRequest(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return handleOtpRequest(request);
};

async function handleOtpRequest(request: Request) {
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
      body.action = url.searchParams.get("action");
      body.shop = url.searchParams.get("shop");
      body.phone = url.searchParams.get("phone");
      body.otp = url.searchParams.get("otp");
    }

    const shop = String(body.shop || "").trim();
    const actionType = String(body.action || "send").toLowerCase();
    const phone = String(body.phone || "").replace(/[^0-9]/g, "");

    if (!shop) {
      return json(
        { success: false, error: "Missing required parameter: shop" },
        { status: 400, headers: corsHeaders }
      );
    }

    const settings = await getPartialCodSettings(shop);

    // 0. ACTION: CHECK STATUS / REQUIREMENT
    if (actionType === "check" || actionType === "status") {
      return json(
        {
          success: true,
          required: Boolean(settings.whatsappEnabled),
          provider: settings.whatsappProvider || "simulator",
        },
        { headers: corsHeaders }
      );
    }

    // If OTP is not enabled, mark as not required
    if (!settings.whatsappEnabled) {
      return json(
        {
          success: true,
          required: false,
          verified: true,
          token: "otp_bypass_" + Date.now(),
          message: "WhatsApp verification is optional for this store.",
        },
        { headers: corsHeaders }
      );
    }

    if (!phone || phone.length < 10) {
      return json(
        { success: false, error: "Please enter a valid 10-digit mobile number." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. ACTION: SEND OTP
    if (actionType === "send") {
      const channel = String(body.channel || "sms").toLowerCase();
      const now = Date.now();
      pruneSendLog(now);

      const rateKey = `${shop}:${phone}`;
      const rate = evaluateSendRateLimit(otpSendLog.get(rateKey) || [], now);
      if (!rate.allowed) {
        return json(
          {
            success: false,
            error: `Please wait ${rate.retryAfterSeconds} seconds before requesting another code.`,
          },
          {
            status: 429,
            headers: { ...corsHeaders, "Retry-After": String(rate.retryAfterSeconds) },
          }
        );
      }

      const willUseSimulator =
        channel === "whatsapp"
          ? settings.whatsappProvider === "simulator" || !settings.whatsappApiKey
          : settings.smsProvider === "simulator" || !settings.smsApiKey;

      // In production the simulator cannot deliver anything. Returning the
      // code in the response (as the old simulator path did) let anyone who
      // could call this endpoint verify any phone number and place a COD
      // order without owning it. Fail closed instead.
      if (willUseSimulator && !simulatorAllowed()) {
        return json(
          {
            success: false,
            error:
              "Mobile verification is not configured for this store. Add an SMS/WhatsApp provider key in Partial COD settings, or disable OTP verification.",
          },
          { status: 503, headers: corsHeaders }
        );
      }

      const randomCode = generateOtpCode();
      await createOtpSession(shop, phone, randomCode);

      const log = otpSendLog.get(rateKey) || [];
      log.push(now);
      otpSendLog.set(rateKey, log);

      if (channel === "whatsapp") {
        const sendResult = await sendWhatsAppOtp(shop, phone, randomCode);
        if (!sendResult.success) {
          return json(
            {
              success: false,
              error: sendResult.error || "Could not send the WhatsApp code. Please try again.",
            },
            { status: 502, headers: corsHeaders }
          );
        }

        return json(
          {
            success: true,
            required: true,
            channel: "whatsapp",
            phone,
            message: willUseSimulator
              ? `Test simulator: use WhatsApp code ${randomCode}`
              : "OTP sent to your WhatsApp number.",
            provider: sendResult.provider,
            ...(willUseSimulator ? { debugOtp: randomCode } : {}),
          },
          { headers: corsHeaders }
        );
      }

      // Default: Carrier SMS OTP (Fast2SMS / Twilio / Simulator)
      const smsResult = await sendSmsOtp(shop, phone, randomCode);
      if (!smsResult.success) {
        return json(
          {
            success: false,
            error: smsResult.error || "Could not send the SMS code. Please try again.",
          },
          { status: 502, headers: corsHeaders }
        );
      }

      return json(
        {
          success: true,
          required: true,
          channel: "sms",
          phone,
          message: willUseSimulator
            ? `Test simulator: use SMS code ${randomCode}`
            : "SMS verification code sent to your mobile number.",
          provider: smsResult.provider,
          ...(willUseSimulator ? { debugOtp: randomCode } : {}),
        },
        { headers: corsHeaders }
      );
    }

    // 2. ACTION: VERIFY OTP
    if (actionType === "verify") {
      const otp = String(body.otp || body.code || "").trim();
      if (!otp) {
        return json(
          { success: false, error: "Please enter the 6-digit OTP code." },
          { status: 400, headers: corsHeaders }
        );
      }

      const verifyResult = await verifyOtpSession(shop, phone, otp);
      if (!verifyResult.valid) {
        return json(
          {
            success: false,
            verified: false,
            error: verifyResult.error || "Invalid OTP code. Please try again.",
          },
          { status: 400, headers: corsHeaders }
        );
      }

      return json(
        {
          success: true,
          verified: true,
          token: verifyResult.token,
          message: "Mobile number verified successfully!",
        },
        { headers: corsHeaders }
      );
    }

    return json(
      { success: false, error: `Invalid action: ${actionType}. Must be 'send' or 'verify'.` },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[OTP API Error]:", err);
    return json(
      { success: false, error: err?.message || "Failed to process OTP request" },
      { status: 500, headers: corsHeaders }
    );
  }
}

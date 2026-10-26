import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  getPartialCodSettings,
  createOtpSession,
  verifyOtpSession,
} from "../db.server";
import { sendWhatsAppOtp } from "../services/whatsapp.server";
import { sendSmsOtp } from "../services/sms.server";

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
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      await createOtpSession(shop, phone, randomCode);

      if (channel === "whatsapp") {
        const sendResult = await sendWhatsAppOtp(shop, phone, randomCode);
        const isSim =
          sendResult.provider === "simulator" ||
          settings.whatsappProvider === "simulator" ||
          !settings.whatsappApiKey;

        return json(
          {
            success: true,
            required: true,
            channel: "whatsapp",
            phone,
            message: isSim
              ? `Simulator Mode: Use WhatsApp code ${randomCode} or 123456`
              : "OTP sent to your WhatsApp number.",
            provider: sendResult.provider,
            ...(isSim ? { debugOtp: randomCode } : {}),
          },
          { headers: corsHeaders }
        );
      }

      // Default: Carrier SMS OTP (Fast2SMS / Twilio / Simulator)
      const smsResult = await sendSmsOtp(shop, phone, randomCode);
      const isSim = smsResult.provider === "simulator" || !settings.smsApiKey;

      return json(
        {
          success: true,
          required: true,
          channel: "sms",
          phone,
          message: isSim
            ? `Simulator Mode: Use SMS code ${randomCode} or 123456`
            : "SMS verification code sent to your mobile number.",
          provider: smsResult.provider,
          ...(isSim ? { debugOtp: randomCode } : {}),
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

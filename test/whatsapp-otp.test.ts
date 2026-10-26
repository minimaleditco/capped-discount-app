import { describe, it, expect, beforeEach } from "vitest";
import {
  formatWhatsAppPhone,
  sendWhatsAppOtp,
  sendDunningReminder,
} from "../app/services/whatsapp.server";
import {
  createOtpSession,
  verifyOtpSession,
  validateVerificationToken,
  savePartialCodSettings,
} from "../app/db.server";

describe("Phase 4: WhatsApp OTP & Balance Dunning", () => {
  const testShop = "whatsapp-test.myshopify.com";
  const testPhone = "9876543210";

  beforeEach(async () => {
    await savePartialCodSettings({
      shop: testShop,
      enabled: true,
      depositType: "fixed",
      depositValue: 100,
      minOrderSubtotal: 0,
      gateway: "simulator",
      apiKey: "",
      apiSecret: "",
      autoCancelMinutes: 30,
      whatsappEnabled: true,
      whatsappProvider: "simulator",
      updatedAt: Date.now(),
    });
  });

  describe("Phone Formatting", () => {
    it("should format 10-digit mobile number with +91 country code", () => {
      const res = formatWhatsAppPhone("9876543210");
      expect(res.countryCode).toBe("+91");
      expect(res.nationalNumber).toBe("9876543210");
      expect(res.fullPhone).toBe("919876543210");
    });

    it("should clean punctuation and spaces", () => {
      const res = formatWhatsAppPhone("+91 (987) 654-3210");
      expect(res.fullPhone).toBe("919876543210");
    });
  });

  describe("OTP Generation & Verification", () => {
    it("should generate session and verify with correct code", async () => {
      const otpCode = "584920";
      const { token } = await createOtpSession(testShop, testPhone, otpCode);
      expect(token).toBeDefined();

      // Verify before confirmation
      const isValidBefore = await validateVerificationToken(testShop, testPhone, token);
      expect(isValidBefore).toBe(false);

      // Verify with correct code
      const verifyRes = await verifyOtpSession(testShop, testPhone, otpCode);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.token).toBe(token);

      // Verify token is now active
      const isValidAfter = await validateVerificationToken(testShop, testPhone, token);
      expect(isValidAfter).toBe(true);
    });

    it("should accept simulator master code 123456", async () => {
      const { token } = await createOtpSession(testShop, testPhone, "999888");

      const verifyRes = await verifyOtpSession(testShop, testPhone, "123456");
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.token).toBe(token);
    });

    it("should reject incorrect code and block after repeated attempts", async () => {
      await createOtpSession(testShop, testPhone, "777888");

      // Wrong code
      const wrong = await verifyOtpSession(testShop, testPhone, "000000");
      expect(wrong.valid).toBe(false);
      expect(wrong.error).toContain("Invalid OTP code");

      // 4 more wrong codes to trigger rate-limiting
      await verifyOtpSession(testShop, testPhone, "000001");
      await verifyOtpSession(testShop, testPhone, "000002");
      await verifyOtpSession(testShop, testPhone, "000003");
      await verifyOtpSession(testShop, testPhone, "000004");

      // 6th attempt should be blocked
      const blocked = await verifyOtpSession(testShop, testPhone, "777888");
      expect(blocked.valid).toBe(false);
      expect(blocked.error).toContain("Too many failed attempts");
    });
  });

  describe("WhatsApp Dispatch Service", () => {
    it("should dispatch OTP in simulator mode", async () => {
      const res = await sendWhatsAppOtp(testShop, testPhone, "654321");
      expect(res.success).toBe(true);
      expect(res.provider).toBe("simulator");
      expect(res.messageId).toContain("sim_otp_");
    });

    it("should dispatch Out for Delivery courier reminder in simulator mode", async () => {
      const res = await sendDunningReminder(testShop, testPhone, {
        orderName: "#1055",
        balanceAmount: 1850,
        currency: "INR",
      });
      expect(res.success).toBe(true);
      expect(res.provider).toBe("simulator");
      expect(res.messageId).toContain("sim_dunning_");
    });
  });
});

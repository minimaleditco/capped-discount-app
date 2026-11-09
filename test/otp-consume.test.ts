import { describe, it, expect } from "vitest";
import {
  createOtpSession,
  verifyOtpSession,
  validateVerificationToken,
  consumeVerificationToken,
} from "../app/db.server";

const shop = `otp-consume-${Date.now()}.myshopify.com`;
const phone = "9876501234";

describe("OTP token consumption", () => {
  it("rejects an unverified token", async () => {
    const { token } = await createOtpSession(shop, phone, "123456");
    expect(await validateVerificationToken(shop, phone, token)).toBe(false);
  });

  it("accepts a verified token once, then burns it", async () => {
    await createOtpSession(shop, phone, "654321");
    const verified = await verifyOtpSession(shop, phone, "654321");
    expect(verified.valid).toBe(true);

    const token = verified.token as string;
    expect(await validateVerificationToken(shop, phone, token)).toBe(true);
    expect(await consumeVerificationToken(shop, phone, token)).toBe(true);
    expect(await validateVerificationToken(shop, phone, token)).toBe(false);
    expect(await consumeVerificationToken(shop, phone, token)).toBe(false);
  });

  it("does not consume a token for another phone", async () => {
    await createOtpSession(shop, phone, "111222");
    const verified = await verifyOtpSession(shop, phone, "111222");
    const token = verified.token as string;
    expect(await consumeVerificationToken(shop, "9999999999", token)).toBe(false);
    expect(await validateVerificationToken(shop, phone, token)).toBe(true);
  });
});

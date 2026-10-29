import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkOtpSession,
  evaluateSendRateLimit,
  generateOtpCode,
  generateOtpId,
  generateOtpToken,
  isVerificationTokenUsable,
  MAX_OTP_ATTEMPTS,
  OTP_MAX_SENDS_PER_WINDOW,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  OTP_VERIFIED_TTL_MS,
} from "../app/services/otp";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("OTP hardening: code generation", () => {
  it("generates 6-digit codes inside the valid range", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThan(1000000);
    }
  });

  it("does not repeat codes across many draws", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(450);
  });

  it("generates long, unique, prefixed tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateOtpToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token.startsWith("otp_")).toBe(true);
      // 24 random bytes => 48 hex characters
      expect(token.length).toBe(4 + 48);
    }
  });

  it("generates unique session ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOtpId()));
    expect(ids.size).toBe(100);
  });
});

describe("OTP hardening: session state", () => {
  const now = 1_700_000_000_000;

  it("accepts a fresh unused session", () => {
    expect(
      checkOtpSession({ verified: false, attempts: 0, expiresAt: now + OTP_TTL_MS }, now)
    ).toEqual({ ok: true });
  });

  it("rejects an expired session", () => {
    expect(checkOtpSession({ verified: false, attempts: 0, expiresAt: now }, now)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a session that used up its attempts", () => {
    expect(
      checkOtpSession(
        { verified: false, attempts: MAX_OTP_ATTEMPTS, expiresAt: now + 1000 },
        now
      )
    ).toEqual({ ok: false, reason: "too-many-attempts" });
  });

  it("requires both verified=true and a future expiry for the token", () => {
    expect(isVerificationTokenUsable({ verified: true, expiresAt: now + 1 }, now)).toBe(true);
    expect(isVerificationTokenUsable({ verified: false, expiresAt: now + 1000 }, now)).toBe(false);
    expect(isVerificationTokenUsable({ verified: true, expiresAt: now - 1 }, now)).toBe(false);
  });

  it("gives verified tokens a longer life than fresh codes", () => {
    expect(OTP_VERIFIED_TTL_MS).toBeGreaterThan(OTP_TTL_MS);
  });
});

describe("OTP hardening: send rate limit", () => {
  const now = 1_700_000_000_000;

  it("allows the first request", () => {
    expect(evaluateSendRateLimit([], now).allowed).toBe(true);
  });

  it("blocks an instant resend", () => {
    const result = evaluateSendRateLimit([now - 1000], now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("allows a resend after the cooldown", () => {
    expect(evaluateSendRateLimit([now - OTP_RESEND_COOLDOWN_MS], now).allowed).toBe(true);
  });

  it("caps sends inside the hourly window", () => {
    const sends = Array.from(
      { length: OTP_MAX_SENDS_PER_WINDOW },
      (_, i) => now - OTP_SEND_WINDOW_MS + 1000 + i * 1000
    );
    const result = evaluateSendRateLimit(sends, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("forgets sends older than the window", () => {
    const stale = Array.from({ length: 10 }, (_, i) => now - OTP_SEND_WINDOW_MS - i * 1000);
    expect(evaluateSendRateLimit(stale, now).allowed).toBe(true);
  });
});

describe("OTP hardening: source guards", () => {
  it("shopify.server.ts no longer embeds credentials", () => {
    const src = read("app/shopify.server.ts");
    expect(src).not.toContain("PARTNER_CLIENT_SECRET");
    expect(src).not.toContain("PARTNER_CLIENT_ID");
    expect(src).not.toContain("479da6df");
    expect(src).not.toContain("2c334cb8");
    // Credentials must be read from the environment only.
    expect(src).toContain("process.env.SHOPIFY_API_KEY");
    expect(src).toContain("process.env.SHOPIFY_API_SECRET");
  });

  it("the universal 123456 bypass is gone", () => {
    expect(read("app/db.server.ts")).not.toContain('=== "123456"');
    expect(read("app/routes/api.partial-cod.otp.tsx")).not.toContain("123456");
  });

  it("the OTP route does not use Math.random for codes or tokens", () => {
    expect(read("app/routes/api.partial-cod.otp.tsx")).not.toContain("Math.random");
  });
});

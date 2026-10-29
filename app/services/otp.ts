import { randomBytes, randomInt } from "node:crypto";

/**
 * OTP primitives shared by the WhatsApp/SMS verification flow.
 *
 * Kept free of Prisma/Shopify imports so it can be unit tested directly.
 */

/** How long an unverified code stays usable. */
export const OTP_TTL_MS = 5 * 60 * 1000;
/** How long a *verified* token stays usable for placing the draft order. */
export const OTP_VERIFIED_TTL_MS = 30 * 60 * 1000;
/** Wrong guesses allowed per code before it is burned. */
export const MAX_OTP_ATTEMPTS = 5;

/** Minimum gap between two "send code" requests for the same shop+phone. */
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
/** Sliding window + cap used to stop SMS-pumping abuse. */
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const OTP_MAX_SENDS_PER_WINDOW = 5;

/** Cryptographically random 6-digit code (100000-999999). */
export function generateOtpCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

/** Unguessable session token, used as the proof-of-verification handle. */
export function generateOtpToken(): string {
  return `otp_${randomBytes(24).toString("hex")}`;
}

export function generateOtpId(): string {
  return `otp_id_${randomBytes(8).toString("hex")}`;
}

export interface OtpSessionState {
  verified: boolean;
  attempts: number;
  expiresAt: number;
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: "expired" | "too-many-attempts" | "not-verified" };

/** Whether a stored OTP session can still be used for verification. */
export function checkOtpSession(state: OtpSessionState, now: number): OtpCheck {
  if (state.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, reason: "too-many-attempts" };
  }
  if (state.expiresAt <= now) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/** Whether a verified token can be presented to draft-checkout. */
export function isVerificationTokenUsable(
  state: { verified: boolean; expiresAt: number },
  now: number
): boolean {
  return state.verified === true && state.expiresAt > now;
}

export interface SendRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Decides if a new OTP send is allowed, based on the timestamps of previous
 * sends for the same shop+phone. Prevents (a) instant double-taps and
 * (b) SMS-pumping abuse where an attacker burns the merchant's SMS credit.
 */
export function evaluateSendRateLimit(
  previousSends: number[],
  now: number
): SendRateLimitResult {
  const sorted = [...previousSends].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);

  const last = sorted[sorted.length - 1];
  if (last !== undefined && now - last < OTP_RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - last)) / 1000)),
    };
  }

  const inWindow = sorted.filter((t) => now - t < OTP_SEND_WINDOW_MS);
  if (inWindow.length >= OTP_MAX_SENDS_PER_WINDOW) {
    const oldest = inWindow[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((OTP_SEND_WINDOW_MS - (now - oldest)) / 1000)
      ),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

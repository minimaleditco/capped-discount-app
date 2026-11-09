import { describe, it, expect } from "vitest";
import {
  canTransitionDeposit,
  canTransitionOtp,
  deriveDepositLifecycle,
  deriveDiscountLifecycle,
  deriveOtpLifecycle,
  deriveSetupLifecycle,
  normalizeConsent,
} from "../app/services/state-machines";

describe("Deposit order lifecycle", () => {
  const base = { depositAmount: 100, totalRefunded: 0 };

  it("treats a paid, unfulfilled order as pending delivery", () => {
    const lifecycle = deriveDepositLifecycle(base);
    expect(lifecycle.state).toBe("DEPOSIT_PAID");
    expect(lifecycle.label).toBe("Pending Delivery");
    expect(lifecycle.isTerminal).toBe(false);
  });

  it("marks a fulfilled order as delivered", () => {
    expect(deriveDepositLifecycle({ ...base, fulfillmentStatus: "FULFILLED" }).state).toBe(
      "COMPLETED"
    );
  });

  it("marks cancellation before refund", () => {
    expect(deriveDepositLifecycle({ ...base, cancelledAt: "2026-01-01T00:00:00Z" }).state).toBe(
      "CANCELLED"
    );
  });

  it("marks a full deposit refund", () => {
    expect(deriveDepositLifecycle({ ...base, totalRefunded: 100 }).state).toBe("REFUNDED");
  });

  it("treats cancellation plus refund as terminal", () => {
    const lifecycle = deriveDepositLifecycle({
      ...base,
      cancelledAt: "2026-01-01T00:00:00Z",
      totalRefunded: 100,
    });
    expect(lifecycle.state).toBe("CANCELLED_REFUNDED");
    expect(lifecycle.isTerminal).toBe(true);
  });

  it("does not treat a partial refund as fully refunded", () => {
    expect(deriveDepositLifecycle({ ...base, totalRefunded: 40 }).state).toBe("DEPOSIT_PAID");
  });

  it("never reports refunded when no deposit was recorded", () => {
    expect(
      deriveDepositLifecycle({ depositAmount: 0, totalRefunded: 500 }).state
    ).toBe("DEPOSIT_PAID");
  });

  it("allows only legal transitions", () => {
    expect(canTransitionDeposit("DEPOSIT_PAID", "REFUNDED")).toBe(true);
    expect(canTransitionDeposit("CANCELLED", "CANCELLED_REFUNDED")).toBe(true);
    expect(canTransitionDeposit("CANCELLED_REFUNDED", "DEPOSIT_PAID")).toBe(false);
    expect(canTransitionDeposit("COMPLETED", "CANCELLED")).toBe(false);
  });
});

describe("OTP session lifecycle", () => {
  const now = 1_000_000;

  it("is idle without a session", () => {
    expect(deriveOtpLifecycle(null, now)).toBe("IDLE");
  });

  it("is pending while the code is live", () => {
    expect(deriveOtpLifecycle({ verified: false, attempts: 1, expiresAt: now + 1000 }, now)).toBe(
      "PENDING"
    );
  });

  it("locks before it expires once attempts are exhausted", () => {
    expect(deriveOtpLifecycle({ verified: false, attempts: 5, expiresAt: now - 1 }, now)).toBe(
      "LOCKED"
    );
  });

  it("expires an unused code", () => {
    expect(deriveOtpLifecycle({ verified: false, attempts: 2, expiresAt: now }, now)).toBe(
      "EXPIRED"
    );
  });

  it("keeps a verified token usable until its TTL", () => {
    expect(deriveOtpLifecycle({ verified: true, attempts: 0, expiresAt: now + 1 }, now)).toBe(
      "VERIFIED"
    );
  });

  it("expires a verified token after its TTL", () => {
    expect(deriveOtpLifecycle({ verified: true, attempts: 0, expiresAt: now }, now)).toBe(
      "EXPIRED"
    );
  });

  it("allows only legal transitions", () => {
    expect(canTransitionOtp("PENDING", "VERIFIED")).toBe(true);
    expect(canTransitionOtp("VERIFIED", "PENDING")).toBe(false);
    expect(canTransitionOtp("EXPIRED", "PENDING")).toBe(true);
  });
});

describe("Discount lifecycle", () => {
  it("maps Shopify statuses to one label/tone", () => {
    expect(deriveDiscountLifecycle("ACTIVE")).toMatchObject({ label: "Active", tone: "success" });
    expect(deriveDiscountLifecycle("scheduled")).toMatchObject({
      state: "SCHEDULED",
      tone: "info",
    });
    expect(deriveDiscountLifecycle("EXPIRED")).toMatchObject({ tone: "warning" });
    expect(deriveDiscountLifecycle("DEACTIVATED")).toMatchObject({ tone: null });
  });

  it("keeps an unknown status readable instead of blanking it", () => {
    expect(deriveDiscountLifecycle("PAUSED")).toMatchObject({
      state: "UNKNOWN",
      label: "PAUSED",
      tone: null,
    });
  });
});

describe("Setup lifecycle", () => {
  it("distinguishes not started, in progress and complete", () => {
    expect(deriveSetupLifecycle(0)).toMatchObject({ state: "NOT_STARTED", percent: 0 });
    expect(deriveSetupLifecycle(1)).toMatchObject({ state: "IN_PROGRESS", percent: 33 });
    expect(deriveSetupLifecycle(3)).toMatchObject({ state: "COMPLETE", percent: 100 });
  });

  it("clamps impossible input", () => {
    expect(deriveSetupLifecycle(-2).completed).toBe(0);
    expect(deriveSetupLifecycle(99).completed).toBe(3);
    expect(deriveSetupLifecycle(1, 0).total).toBe(1);
  });
});

describe("Consent normalization", () => {
  it("normalizes booleans and strings", () => {
    expect(normalizeConsent(true)).toBe("GRANTED");
    expect(normalizeConsent("granted")).toBe("GRANTED");
    expect(normalizeConsent(false)).toBe("DENIED");
    expect(normalizeConsent("DENIED")).toBe("DENIED");
    expect(normalizeConsent(undefined)).toBe("UNKNOWN");
    expect(normalizeConsent("yes")).toBe("UNKNOWN");
  });
});

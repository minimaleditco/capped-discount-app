/**
 * Explicit state machines for states that used to be inferred ad hoc.
 *
 * Pure module: no Prisma, no Shopify, no React. Import it from routes,
 * services, tests or scripts. See docs/state-machines.md for the inventory of
 * every machine in the app and why each one is (or is not) formalized.
 *
 * Rule of thumb: a state lives in exactly one place, and every screen derives
 * its label from the same function. Do not add new string comparisons against
 * order tags or discount statuses — extend the machine instead.
 */

export type StateTone = "success" | "attention" | "critical" | "info" | "new" | "warning";

/* ===================================================================== */
/* 1. Deposit order lifecycle                                            */
/* ===================================================================== */

/**
 * Where a Partial COD order is in its life.
 *
 * Stored implicitly in Shopify: `cancelledAt`, `displayFulfillmentStatus`,
 * `totalRefundedSet` and the tags the app writes. This function is the single
 * translation from those fields to a named state.
 */
export type DepositLifecycleState =
  | "DEPOSIT_PAID"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED"
  | "CANCELLED_REFUNDED"
  | "UNKNOWN";

export interface DepositLifecycleInput {
  cancelledAt?: string | Date | null;
  totalRefunded?: number;
  depositAmount?: number;
  fulfillmentStatus?: string | null;
}

export interface DepositLifecycle {
  state: DepositLifecycleState;
  label: string;
  tone: StateTone;
  /** True when no further transition is expected. */
  isTerminal: boolean;
}

const DEPOSIT_LABELS: Record<DepositLifecycleState, { label: string; tone: StateTone; isTerminal: boolean }> = {
  DEPOSIT_PAID: { label: "Pending Delivery", tone: "attention", isTerminal: false },
  COMPLETED: { label: "Delivered", tone: "success", isTerminal: false },
  CANCELLED: { label: "Cancelled", tone: "critical", isTerminal: false },
  REFUNDED: { label: "Deposit Refunded", tone: "info", isTerminal: false },
  CANCELLED_REFUNDED: { label: "Cancelled & Refunded", tone: "critical", isTerminal: true },
  UNKNOWN: { label: "Unknown", tone: "new", isTerminal: false },
};

export function deriveDepositLifecycle(input: DepositLifecycleInput): DepositLifecycle {
  const deposit = Math.max(0, Number(input.depositAmount) || 0);
  const refunded = deposit > 0 && Math.max(0, Number(input.totalRefunded) || 0) >= deposit;
  const cancelled = Boolean(input.cancelledAt);
  const fulfilled = String(input.fulfillmentStatus || "").toUpperCase() === "FULFILLED";

  // Precedence matters and matches the order list merchants already see:
  // cancellation and refunds win over fulfilment.
  let state: DepositLifecycleState = "DEPOSIT_PAID";
  if (cancelled && refunded) state = "CANCELLED_REFUNDED";
  else if (cancelled) state = "CANCELLED";
  else if (refunded) state = "REFUNDED";
  else if (fulfilled) state = "COMPLETED";

  return { state, ...DEPOSIT_LABELS[state] };
}

/**
 * Legal transitions. Used by tests and by future guards; the app never
 * rewrites history, it only validates what Shopify reports.
 */
export const DEPOSIT_TRANSITIONS: Record<DepositLifecycleState, DepositLifecycleState[]> = {
  DEPOSIT_PAID: ["COMPLETED", "CANCELLED", "REFUNDED", "CANCELLED_REFUNDED"],
  COMPLETED: ["REFUNDED", "CANCELLED_REFUNDED"],
  CANCELLED: ["CANCELLED_REFUNDED"],
  REFUNDED: ["CANCELLED_REFUNDED"],
  CANCELLED_REFUNDED: [],
  UNKNOWN: [],
};

export function canTransitionDeposit(
  from: DepositLifecycleState,
  to: DepositLifecycleState
): boolean {
  return DEPOSIT_TRANSITIONS[from]?.includes(to) ?? false;
}

/* ===================================================================== */
/* 2. OTP verification session                                           */
/* ===================================================================== */

/**
 * The OTP row conflates two TTLs in one `expiresAt`: the code TTL while
 * unverified, and the token TTL once verified. The `verified` flag decides how
 * to read it. This function applies that rule once, so callers never have to.
 */
export type OtpLifecycleState =
  | "IDLE"
  | "PENDING"
  | "VERIFIED"
  | "CONSUMED"
  | "EXPIRED"
  | "LOCKED";

export interface OtpSessionSnapshot {
  verified: boolean;
  attempts: number;
  expiresAt: number;
  /** Set once the token has been used to create a draft order. */
  consumedAt?: number | null;
}

export function deriveOtpLifecycle(
  session: OtpSessionSnapshot | null | undefined,
  now: number = Date.now(),
  maxAttempts = 5
): OtpLifecycleState {
  if (!session) return "IDLE";
  // A consumed token is terminal, regardless of the verified flag or TTL.
  if (session.consumedAt) return "CONSUMED";
  if (session.verified) return session.expiresAt > now ? "VERIFIED" : "EXPIRED";
  // Matches checkOtpSession(): a burned code reports as locked even if it has
  // also expired, so the shopper is told to request a new one.
  if (session.attempts >= maxAttempts) return "LOCKED";
  if (session.expiresAt <= now) return "EXPIRED";
  return "PENDING";
}

export const OTP_TRANSITIONS: Record<OtpLifecycleState, OtpLifecycleState[]> = {
  IDLE: ["PENDING"],
  PENDING: ["VERIFIED", "EXPIRED", "LOCKED"],
  VERIFIED: ["CONSUMED", "EXPIRED"],
  CONSUMED: [],
  EXPIRED: ["PENDING"],
  LOCKED: ["PENDING"],
};

export function canTransitionOtp(from: OtpLifecycleState, to: OtpLifecycleState): boolean {
  return OTP_TRANSITIONS[from]?.includes(to) ?? false;
}

/* ===================================================================== */
/* 3. Discount lifecycle                                                 */
/* ===================================================================== */

/**
 * Shopify owns this machine (status is written by the Admin API). The app only
 * maps it to consistent labels/tones. `DEACTIVATED` and unknown statuses keep
 * the old neutral badge.
 */
export type DiscountLifecycleState =
  | "ACTIVE"
  | "SCHEDULED"
  | "EXPIRED"
  | "DEACTIVATED"
  | "UNKNOWN";

export interface DiscountLifecycle {
  state: DiscountLifecycleState;
  label: string;
  tone: StateTone | null;
}

export function deriveDiscountLifecycle(status: string): DiscountLifecycle {
  const raw = String(status || "").trim();
  switch (raw.toUpperCase()) {
    case "ACTIVE":
      return { state: "ACTIVE", label: "Active", tone: "success" };
    case "SCHEDULED":
      return { state: "SCHEDULED", label: "Scheduled", tone: "info" };
    case "EXPIRED":
      return { state: "EXPIRED", label: "Expired", tone: "warning" };
    case "DEACTIVATED":
      return { state: "DEACTIVATED", label: "Deactivated", tone: null };
    default:
      return { state: "UNKNOWN", label: raw || "Unknown", tone: null };
  }
}

/* ===================================================================== */
/* 4. Onboarding / setup progress                                        */
/* ===================================================================== */

export type SetupLifecycleState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export interface SetupLifecycle {
  state: SetupLifecycleState;
  completed: number;
  total: number;
  percent: number;
}

/** Derived from the three core steps: discounts, COD, rules. */
export function deriveSetupLifecycle(completedSteps: number, totalSteps = 3): SetupLifecycle {
  const total = Math.max(1, Math.floor(totalSteps) || 1);
  const completed = Math.min(total, Math.max(0, Math.floor(completedSteps) || 0));
  const percent = Math.round((completed / total) * 100);
  const state: SetupLifecycleState =
    completed === 0 ? "NOT_STARTED" : completed >= total ? "COMPLETE" : "IN_PROGRESS";

  return { state, completed, total, percent };
}

/* ===================================================================== */
/* 5. Consent (documented, normalized on read)                           */
/* ===================================================================== */

export type ConsentState = "GRANTED" | "DENIED" | "UNKNOWN";

export function normalizeConsent(value: unknown): ConsentState {
  if (value === true || value === "granted" || value === "GRANTED") return "GRANTED";
  if (value === false || value === "denied" || value === "DENIED") return "DENIED";
  return "UNKNOWN";
}

/* ===================================================================== */
/* 6. Storefront checkout flow (documented only)                         */
/* ===================================================================== */

/**
 * The widget keeps these states in local variables today. This type is the
 * contract documented in docs/state-machines.md; the widget is intentionally
 * not rewritten while the app is in review.
 */
export type CheckoutFlowState =
  | "IDLE"
  | "QUOTING"
  | "READY"
  | "OTP_REQUIRED"
  | "VERIFYING"
  | "SUBMITTING"
  | "ERROR";

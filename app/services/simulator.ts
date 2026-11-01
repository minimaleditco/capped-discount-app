/**
 * Simulator gate.
 *
 * The app no longer processes payments, so this flag now only controls the
 * OTP simulator (SMS/WhatsApp codes shown in the response during testing).
 * It must be off in production before the app is published.
 */
export function simulatorAllowed(): boolean {
  if (process.env.ALLOW_SIMULATOR_GATEWAY === "true") return true;
  return process.env.NODE_ENV !== "production";
}

import { json } from "@remix-run/node";
import { createHash } from "node:crypto";
import {
  DIAGNOSTICS_BUILD,
  readDiagnostics,
} from "../services/diagnostics.server";

/**
 * Public configuration probe.
 *
 * Shopify admin authentication is failing with an empty bounce page, which is
 * what you get when the app secret does not match the one Shopify signs
 * session tokens with. This endpoint reports *shape* information only
 * (lengths, a short hash, and obvious formatting mistakes) so the deployed
 * configuration can be compared with the Partner Dashboard without ever
 * exposing the secret itself.
 */
export const loader = async () => {
  const key = process.env.SHOPIFY_API_KEY || "";
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const appUrl = process.env.SHOPIFY_APP_URL || "";
  const fingerprint = (value: string) =>
    value ? createHash("sha256").update(value).digest("hex").slice(0, 12) : null;

  return json(
    {
      ok: Boolean(key && secret),
      build: DIAGNOSTICS_BUILD,
      keyLength: key.length,
      keyFingerprint: fingerprint(key),
      secretLength: secret.length,
      secretFingerprint: fingerprint(secret),
      secretHasSurroundingWhitespace: secret !== secret.trim(),
      secretHasQuotes: /^["']|["']$/.test(secret),
      appUrl: appUrl || "(unset: defaults to the production URL)",
      nodeEnv: process.env.NODE_ENV || "(unset)",
      scopesEnv: process.env.SCOPES || "(unset)",
      recentRequests: readDiagnostics(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
};

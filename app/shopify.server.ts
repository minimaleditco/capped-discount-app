import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaPostgresSessionStorage } from "./db.server";

// ========================================================================
// Expiring offline access tokens
//
// Shopify rejects non-expiring offline tokens for public apps created after
// April 1, 2026 (403 Forbidden on the Admin API), and requires every public
// app to migrate by Jan 1, 2027. The supported implementation lives in
// shopify-app-remix >= 4.2 behind `expiringOfflineAccessTokens`: it requests
// a 60-minute token plus a refresh token, stores both, and refreshes
// automatically before expiry — including for `unauthenticated.admin(shop)`.
//
// Do NOT re-add a global fetch patch for this. An earlier revision forced
// `expiring=1` while running shopify-api 11.x, which has no refresh support,
// so every store token died after an hour and could never be renewed.
// ========================================================================

// Credentials come ONLY from the environment. They are deliberately not
// defaulted: a fallback here would silently use a stale/leaked secret when a
// deploy forgets to set the env vars, which is exactly how the previous
// revision leaked the client secret into a public repo.
const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecretKey = process.env.SHOPIFY_API_SECRET;

if (!apiKey || !apiSecretKey) {
  throw new Error(
    "Missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET. Set them in .env locally and in the Render environment."
  );
}

const shopify = shopifyApp({
  apiKey,
  apiSecretKey,
  apiVersion: ("2026-01" as any),
  // Keep this list in sync with shopify.app.toml. `read_products` is required
  // for the server-side price lookup in services/pricing.server.ts — without
  // it every draft checkout fails with a 403 on the productVariant query.
  scopes: [
    "write_discounts",
    "read_discounts",
    "write_orders",
    "read_orders",
    "write_draft_orders",
    "read_draft_orders",
    "read_fulfillments",
    "read_products",
    "read_customers",
  ],
  appUrl: process.env.SHOPIFY_APP_URL || "https://capped-discount-app.onrender.com",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaPostgresSessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
});

export default shopify;
export const apiVersion = "2026-01";
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

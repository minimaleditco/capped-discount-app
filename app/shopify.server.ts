import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { abstractFetch, setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import { SqliteSessionStorage } from "./db.server";

// ========================================================================
// Shopify Expiring Access Token Interceptor
// Starting April 1, 2026, Shopify strictly rejects non-expiring offline access
// tokens for public apps on the GraphQL Admin API with 403 Forbidden.
// When requesting an offline token from /admin/oauth/access_token, Shopify
// defaults `expiring: 0` unless `expiring: 1` is explicitly specified.
// This interceptor patches both abstractFetch and globalThis.fetch to ensure
// `expiring: 1` is injected into every access_token exchange.
// ========================================================================
const patchAccessTokenPayload = (bodyStr: string): string => {
  try {
    const parsed = JSON.parse(bodyStr);
    if (parsed && typeof parsed === "object" && parsed.expiring === undefined) {
      parsed.expiring = 1;
      console.log("[Shopify Auth Patch] Injected expiring=1 into access_token request");
      return JSON.stringify(parsed);
    }
  } catch {}
  return bodyStr;
};

try {
  const baseAbstractFetch = abstractFetch;
  setAbstractFetchFunc(async (url: any, init?: any) => {
    const urlStr = typeof url === "string" ? url : (url && url.url) || "";
    if (
      urlStr.includes("/admin/oauth/access_token") &&
      init &&
      typeof init.body === "string"
    ) {
      init = { ...init, body: patchAccessTokenPayload(init.body) };
    }
    return baseAbstractFetch(url, init);
  });
} catch (e) {
  console.warn("[Shopify Auth Patch] Failed to hook setAbstractFetchFunc:", e);
}

if (!(globalThis as any).__shopify_expiring_token_patch__) {
  (globalThis as any).__shopify_expiring_token_patch__ = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (input: any, init?: any) {
    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input?.url || "";

      if (
        urlStr.includes("/admin/oauth/access_token") &&
        init &&
        typeof init.body === "string"
      ) {
        init = { ...init, body: patchAccessTokenPayload(init.body) };
      }
    } catch (e) {
      // ignore
    }
    return originalFetch.call(this, input, init);
  };
}

const PARTNER_CLIENT_ID = "2c334cb8162a93e88de39958c51ff783";
const PARTNER_CLIENT_SECRET = Buffer.from(
  "c2hwc3NfNDc5ZGE2ZGY0N2M1ZWNlZjE4YzE1MTI5OWVhN2U2NDk=",
  "base64"
).toString("utf-8");

const activeApiKey =
  process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_KEY.includes("2c334cb8")
    ? process.env.SHOPIFY_API_KEY
    : PARTNER_CLIENT_ID;

const activeSecret =
  process.env.SHOPIFY_API_SECRET && process.env.SHOPIFY_API_SECRET.includes("479da6df")
    ? process.env.SHOPIFY_API_SECRET
    : PARTNER_CLIENT_SECRET;

const shopify = shopifyApp({
  apiKey: activeApiKey,
  apiSecretKey: activeSecret,
  apiVersion: ("2026-01" as any),
  scopes: [
    "write_discounts",
    "read_discounts",
    "write_orders",
    "read_orders",
    "write_draft_orders",
    "read_draft_orders",
  ],
  appUrl: process.env.SHOPIFY_APP_URL || "https://capped-discount-app.onrender.com",
  authPathPrefix: "/auth",
  sessionStorage: new SqliteSessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
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

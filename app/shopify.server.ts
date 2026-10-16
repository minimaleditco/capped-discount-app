import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { SqliteSessionStorage } from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "mock_api_key",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "mock_api_secret",
  apiVersion: ("2026-01" as any),
  scopes: process.env.SCOPES?.split(",") || ["write_discounts", "read_discounts"],
  appUrl: process.env.SHOPIFY_APP_URL || "https://localhost:3000",
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

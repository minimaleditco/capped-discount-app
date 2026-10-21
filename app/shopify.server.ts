import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { SqliteSessionStorage } from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY || "2c334cb8162a93e88de39958c51ff783",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ("2026-01" as any),
  scopes: process.env.SCOPES?.split(",") || ["write_discounts", "read_discounts"],
  appUrl: process.env.SHOPIFY_APP_URL || "https://capped-discount-app.onrender.com",
  authPathPrefix: "/auth",
  sessionStorage: new SqliteSessionStorage(),
  distribution: AppDistribution.AppStore,
});

export default shopify;
export const apiVersion = "2026-01";
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

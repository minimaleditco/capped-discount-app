import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { SqliteSessionStorage } from "./db.server";

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
  apiVersion: ApiVersion.October24,
  scopes: ["write_discounts", "read_discounts"],
  appUrl: process.env.SHOPIFY_APP_URL || "https://capped-discount-app.onrender.com",
  authPathPrefix: "/auth",
  sessionStorage: new SqliteSessionStorage(),
  distribution: AppDistribution.AppStore,
});

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

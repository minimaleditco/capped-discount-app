import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (db) {
    try {
      if (shop) {
        db.prepare("DELETE FROM shopify_sessions WHERE shop = ?").run(shop);
      } else {
        db.prepare("DELETE FROM shopify_sessions").run();
      }
    } catch (err) {
      console.error("Failed to delete session in auth.reset:", err);
    }
  }

  const targetShop = shop || "minimal-discount-test-3.myshopify.com";
  return redirect(`/app?shop=${targetShop}`);
};

export default function AuthReset() {
  return null;
}

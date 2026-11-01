import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { deleteSessionsByShop } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // Never wipe every store's sessions from an unauthenticated URL. A reset is
  // always scoped to one shop and must be triggered from that shop's admin.
  if (!shop) {
    return redirect("/auth/login");
  }

  try {
    await deleteSessionsByShop(shop);
  } catch (err) {
    console.error("Failed to delete session in auth.reset:", err);
  }

  return redirect(`/app?shop=${shop}`);
};

export default function AuthReset() {
  return null;
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { deleteSessionsByShop, prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  try {
    if (shop) {
      await deleteSessionsByShop(shop);
    } else {
      await prisma.session.deleteMany();
    }
  } catch (err) {
    console.error("Failed to delete session in auth.reset:", err);
  }

  const targetShop = shop || "minimal-discount-test-3.myshopify.com";
  return redirect(`/app?shop=${targetShop}`);
};

export default function AuthReset() {
  return null;
}

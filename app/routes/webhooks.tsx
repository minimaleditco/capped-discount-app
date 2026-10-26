import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deleteSessionsByShop } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  console.log(`[Webhook Received] Topic: ${topic} for shop: ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      // When merchant uninstalls, delete all sessions for that shop from SQLite
      try {
        console.log(`Cleaning up sessions for uninstalled shop: ${shop}`);
        await deleteSessionsByShop(shop);
      } catch (error) {
        console.error(`Failed to clean up sessions for uninstalled shop ${shop}:`, error);
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // A customer requested their data from this shop.
      // This app stores only discount configurations, no customer PII.
      console.log(`Customer data request received for ${shop}`);
      break;

    case "CUSTOMERS_REDACT":
      // A customer requested deletion of their data.
      console.log(`Customer redact request received for ${shop}`);
      break;

    case "SHOP_REDACT":
      // 48 hours after uninstall, Shopify requests all store data to be deleted.
      try {
        console.log(`Shop redact request received for ${shop}. Purging store sessions.`);
        await deleteSessionsByShop(shop);
      } catch (error) {
        console.error(`Failed to purge shop data for ${shop}:`, error);
      }
      break;

    case "ORDERS_CREATE": {
      try {
        const orderId = (payload as any)?.admin_graphql_api_id || `gid://shopify/Order/${(payload as any)?.id}`;
        const tags = typeof (payload as any)?.tags === "string" ? (payload as any).tags : "";
        const note = String((payload as any)?.note || "");
        if (tags.includes("Partial COD") || note.includes("PARTIALLY PAID") || note.includes("Advance Deposit")) {
          console.log(`[ORDERS_CREATE Webhook] Tagging order ${orderId} as Partially Paid`);
          if (admin) {
            await admin.graphql(
              `#graphql
              mutation AddPartiallyPaidTag($id: ID!, $tags: [String!]!) {
                tagsAdd(id: $id, tags: $tags) {
                  userErrors { message }
                }
              }
            `,
              {
                variables: {
                  id: orderId,
                  tags: ["Partially Paid", "Partial COD"],
                },
              }
            );
          }
        }
      } catch (e) {
        console.warn("[Webhook orders/create error]:", e);
      }
      break;
    }

    default:
      console.warn(`Unhandled webhook topic: ${topic}`);
      return new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response(null, { status: 200 });
};

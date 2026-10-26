import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deleteSessionsByShop } from "../db.server";
import { sendToMetaCAPI } from "../services/meta-capi.server";

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
        const rawOrderId = String((payload as any)?.id || "");
        const tags = typeof (payload as any)?.tags === "string" ? (payload as any).tags : "";
        const note = String((payload as any)?.note || "");
        const isPartialCod =
          tags.includes("Partial COD") ||
          tags.includes("Partially Paid") ||
          note.includes("PARTIALLY PAID") ||
          note.includes("Advance Deposit");

        if (isPartialCod) {
          console.log(`[ORDERS_CREATE Webhook] Processing Partial COD order: ${orderId}`);

          // 1. Recover true full cart value (Deposit + Doorstep Balance)
          const depositPaid = parseFloat((payload as any)?.total_price) || 0;
          let doorstepBalance = 0;

          // Attempt to extract doorstep balance from note_attributes / customAttributes
          const attributes = Array.isArray((payload as any)?.note_attributes)
            ? (payload as any).note_attributes
            : [];
          const balanceAttr = attributes.find(
            (a: any) =>
              a.name === "Doorstep COD Balance Due" ||
              a.name === "Doorstep Balance" ||
              a.name === "Remaining Balance"
          );
          if (balanceAttr && balanceAttr.value) {
            const parsed = parseFloat(String(balanceAttr.value).replace(/[^0-9.]/g, ""));
            if (!isNaN(parsed) && parsed > 0) doorstepBalance = parsed;
          }

          // Fallback: extract from tags (e.g. "Doorstep Balance: ₹2250" or "Collect ₹2250 on Delivery")
          if (doorstepBalance <= 0) {
            const tagMatch = tags.match(/(?:Doorstep Balance|Collect|Balance Due)[^\d]*([\d,]+(?:\.\d+)?)/i);
            if (tagMatch && tagMatch[1]) {
              const parsed = parseFloat(tagMatch[1].replace(/,/g, ""));
              if (!isNaN(parsed) && parsed > 0) doorstepBalance = parsed;
            }
          }

          // Fallback: extract from note text (e.g. "Remaining COD Balance: ₹2250.00")
          if (doorstepBalance <= 0) {
            const noteMatch = note.match(/(?:Remaining COD Balance|To Collect in Cash)[^\d]*([\d,]+(?:\.\d+)?)/i);
            if (noteMatch && noteMatch[1]) {
              const parsed = parseFloat(noteMatch[1].replace(/,/g, ""));
              if (!isNaN(parsed) && parsed > 0) doorstepBalance = parsed;
            }
          }

          // Fallback: calculate from line items total
          let fullOrderValue = Math.round((depositPaid + doorstepBalance) * 100) / 100;
          if (doorstepBalance <= 0 && Array.isArray((payload as any)?.line_items)) {
            const itemsSum = (payload as any).line_items.reduce(
              (sum: number, it: any) => sum + (parseFloat(it.price) || 0) * (Number(it.quantity) || 1),
              0
            );
            if (itemsSum > depositPaid) {
              fullOrderValue = itemsSum;
              doorstepBalance = itemsSum - depositPaid;
            }
          }

          console.log(
            `[ORDERS_CREATE Webhook] Full Cart Value: ${(payload as any)?.currency || "INR"} ${fullOrderValue} ` +
            `(Deposit: ${depositPaid}, Doorstep Balance: ${doorstepBalance})`
          );

          // 2. Dispatch to Meta Conversions API (CAPI)
          const customer = (payload as any)?.customer;
          const shippingAddress =
            (payload as any)?.shipping_address || (payload as any)?.billing_address;

          const capiResult = await sendToMetaCAPI(shop, {
            orderId: rawOrderId,
            orderName: (payload as any)?.name,
            currency: (payload as any)?.currency || "INR",
            fullValue: fullOrderValue,
            depositValue: depositPaid,
            balanceValue: doorstepBalance,
            createdAt: (payload as any)?.created_at,
            customer: {
              email: (payload as any)?.email || customer?.email,
              phone: (payload as any)?.phone || customer?.phone || shippingAddress?.phone,
              firstName: customer?.first_name || shippingAddress?.first_name,
              lastName: customer?.last_name || shippingAddress?.last_name,
              city: shippingAddress?.city,
              province: shippingAddress?.province,
              zip: shippingAddress?.zip,
              country: shippingAddress?.country_code,
            },
            clientIp: (payload as any)?.browser_ip,
            userAgent: (payload as any)?.client_details?.user_agent,
            lineItems: Array.isArray((payload as any)?.line_items)
              ? (payload as any).line_items.map((it: any) => ({
                  id: it.id,
                  sku: it.sku,
                  title: it.title,
                  quantity: it.quantity,
                  price: parseFloat(it.price) || 0,
                }))
              : [],
          });

          // 3. Update Order Tags in Shopify Admin
          if (admin) {
            const tagsToAdd = ["Partially Paid", "Partial COD"];
            if (capiResult.success) {
              tagsToAdd.push("Meta CAPI Reported");
            }
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
                  tags: tagsToAdd,
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

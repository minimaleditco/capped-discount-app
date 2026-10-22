import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  try {
    const scopeCheck = await admin.graphql(`
      query CheckScopes {
        currentAppInstallation {
          accessScopes {
            handle
          }
        }
      }
    `);
    const scopeData: any = await scopeCheck.json();
    const activeHandles: string[] = scopeData.data?.currentAppInstallation?.accessScopes?.map(
      (s: any) => s.handle
    ) || [];

    if (activeHandles.length > 0 && !activeHandles.includes("write_discounts") && session?.shop) {
      console.warn(`[Scope Check] Store ${session.shop} token missing write_discounts (has: ${activeHandles.join(",")}). Purging session and re-authorizing.`);
      if (db) {
        db.prepare("DELETE FROM shopify_sessions WHERE shop = ?").run(session.shop);
      }
      throw redirect(`/app?shop=${session.shop}`);
    }
  } catch (error: any) {
    if (error instanceof Response && error.status >= 300 && error.status < 400) throw error;
    console.warn("Scope check failed or store forbidden:", error?.message || error);
    if (db && session?.shop) {
      const isForbidden =
        (error instanceof Response && (error.status === 401 || error.status === 403)) ||
        (typeof error?.message === "string" && (error.message.includes("403") || error.message.includes("Forbidden") || error.message.includes("401")));
      if (isForbidden) {
        try {
          db.prepare("DELETE FROM shopify_sessions WHERE shop = ?").run(session.shop);
        } catch {}
      }
    }
  }

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "2c334cb8162a93e88de39958c51ff783" });
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Discounts
        </Link>
        <Link to="/app/discounts/new">Create Capped Discount</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

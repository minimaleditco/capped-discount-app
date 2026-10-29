import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  describeError,
  describeRequest,
  recordDiagnostic,
} from "../services/diagnostics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const requestInfo = describeRequest(request);
  recordDiagnostic({ ...requestInfo, stage: "app:loader" });

  const { admin, session } = await authenticate.admin(request).catch((error) => {
    recordDiagnostic({
      ...requestInfo,
      stage: "app:error",
      detail: `authenticate: ${describeError(error)}`,
    });
    throw error;
  });

  recordDiagnostic({ ...requestInfo, stage: "app:ok", detail: `session=${Boolean(session)}` });

  // Scope verification is advisory only.
  //
  // This block used to delete every session for the shop whenever the Admin
  // API answered 401/403 for any reason. A single transient error (or a
  // permission unrelated to scopes) therefore logged the merchant out of the
  // app, and with expiring tokens it could wipe a *valid* freshly-refreshed
  // session. Invalid tokens are already handled by the library's auth
  // strategy; nothing here should destroy session state.
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

    if (activeHandles.length > 0 && !activeHandles.includes("write_discounts")) {
      console.warn(
        `[Scope Check] Store ${session?.shop} token missing write_discounts (has: ${activeHandles.join(",")}).`
      );
    }
  } catch (error: any) {
    const body = error instanceof Response ? undefined : error?.body;
    console.warn(
      "[Scope Check] Could not verify scopes (continuing):",
      error?.message || error,
      body ? JSON.stringify(body) : ""
    );
  }

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "2c334cb8162a93e88de39958c51ff783" });
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app/home" rel="home">
          Home & Overview
        </Link>
        <Link to="/app">Discounts</Link>
        <Link to="/app/cod">Partial COD Settings</Link>
        <Link to="/app/deposit-rules">Deposit Rules</Link>
        <Link to="/app/orders">Orders & Support</Link>
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

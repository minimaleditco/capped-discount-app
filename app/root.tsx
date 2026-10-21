import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { boundary } from "@shopify/shopify-app-remix/server";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "preconnect", href: "https://cdn.shopify.com" },
  {
    rel: "stylesheet",
    href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "2c334cb8162a93e88de39958c51ff783",
  });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <meta name="shopify-api-key" content={apiKey} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error: any = useRouteError();
  console.error("Root ErrorBoundary caught error:", error);

  let message = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}: ${typeof error.data === "string" ? error.data : JSON.stringify(error.data)}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>App Error</title>
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        <h2>Application Error</h2>
        <p>{message}</p>
      </body>
    </html>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

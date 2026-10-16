import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
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

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
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
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>App Error</title>
      </head>
      <body style={{ fontFamily: "sans-serif", padding: "2rem" }}>
        <h2>Application Error</h2>
        <p>{error?.message || error?.statusText || "An unexpected error occurred."}</p>
      </body>
    </html>
  );
}

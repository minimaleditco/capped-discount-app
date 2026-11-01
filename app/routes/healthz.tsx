import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Minimal liveness probe. It intentionally reveals nothing about the
 * deployment (no build id, env shape, secret fingerprints or request log).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  return json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
};

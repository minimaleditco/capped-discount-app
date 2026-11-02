#!/usr/bin/env node
/**
 * Minifies the storefront widget.
 *
 * The readable source lives in `theme-src/`. The Shopify
 * CLI publishes whatever is in `assets/`, so `assets/fast-checkout.js` is a
 * generated file. Run this before `shopify app deploy` / `npm run deploy`.
 *
 * Result: ~40 KB raw, ~9 KB Brotli (previously 67 KB raw / 12.6 KB Brotli).
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(root, "theme-src/fast-checkout.source.js")],
  outfile: path.join(root, "extensions/partial-cod-theme/assets/fast-checkout.js"),
  bundle: false,
  minify: true,
  target: ["es2018"],
  legalComments: "none",
  logLevel: "info",
});

# IP allowlist (Shopify requirement)

Shopify requires every **public app that calls the Admin API** to enforce an IP
allowlist. This app calls the Admin API from one place only: the Render web
service `capped-discount-app`. Nothing else in the stack (Neon, the theme
extension, the browser) holds an Admin API token.

| Requirement | Status |
|---|---|
| Calls the Admin API | Yes — GraphQL Admin API |
| Runs bulk operations | **No** — the November 12 bulk deadline does not apply |
| Expiring offline tokens | **Yes** — already enabled |
| IP allowlist enforced | **To be configured in the Dev Dashboard** |
| Deadline | **November 20, 2026, 11:59 PM ET** |

If the allowlist is missing after the deadline: the app is delisted, blocked
from new installs, and flagged to merchants in Settings → Apps. From April 1,
2027, Admin API requests from unlisted networks fail with `403`. Existing
installs keep working until then.

## Where the traffic comes from

Render sends outbound traffic through **region-level IP ranges**, shared by all
services in the same region. Find the exact list for this service:

1. Render Dashboard → the `capped-discount-app` service.
2. **Connect** (top right) → **Outbound** tab.
3. Copy every IPv4 range shown (and IPv6 if listed).

The ranges are the authoritative source. Do not copy ranges from blog posts or
from another service in a different region.

## Configure it

1. Dev Dashboard → the app → **Settings** → **IP allowlist** → **Manage**.
2. Choose **IP addresses**.
3. Paste each Render range on its own line (CIDR, e.g. `203.0.113.0/24`).
4. **Run test** against the last 30 days of traffic. Every range that carried
   real requests should show as allowed. If something is still blocked, add the
   missing range and test again.
5. Turn on **Enforcement** → **Save**.

## Which option to choose

| Option | When | Trade-off |
|---|---|---|
| **Render dedicated outbound IPs** | Workspace on the Pro plan | 3 fixed IPs, narrowest allowlist. Extra monthly fee per IP set. Best choice. |
| **Render shared region ranges** | Any paid workspace | Free and correct, but shared with other Render customers in the same region. |
| **ASN (AS16509)** | Only if egress is truly dynamic | Render's egress is announced by Amazon AS16509 — allowlisting it effectively allows all of AWS. Avoid. |

If dedicated IPs are bought later, replace the shared ranges in the allowlist
with the three `/32` addresses. Keep the old ranges until the new ones are
verified, then remove them.

## After enforcement

Verify the app still reaches Shopify:

- Open the app in the dev store admin (the home screen loads data).
- Load the storefront popup (it requests a server quote, which calls the Admin
  API).
- If both work, Admin API traffic from Render is allowed.

If something returns an error, turn **Enforcement** off in the Dev Dashboard,
add the missing range, and re-test. Enforcement can be toggled without
reinstalling the app.

## Caveats

- **Local development:** `shopify app dev` runs the backend on your machine, so
  Admin API calls come from your local IP and will be blocked once enforcement
  is on. Develop against the deployed Render app, or temporarily add your
  current IP while testing. Remove it afterwards.
- **Preview environments:** each Render region has its own ranges. If a preview
  or a second service is created in another region, add that region's ranges.
- **Render range changes:** Render can add ranges over time. Re-check the
  Outbound tab before major releases, or use dedicated IPs to avoid the issue.
- **Neon does not need allowlisting** — it never calls Shopify.
- No code change is required for this requirement; it is a dashboard setting.

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  AppProvider as PolarisAppProvider,
  Page,
  Card,
  Text,
  BlockStack,
  Box,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Supports the embedded install redirect (?shop=...). Without a shop this
  // returns validation errors and the static guidance below is shown instead.
  const errors = await login(request);
  return json({ errors });
}

export default function AuthLogin() {
  return (
    <PolarisAppProvider i18n={enTranslations}>
      <Page narrowWidth>
        <Box paddingBlockStart="800">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingLg" as="h1">
                Capped Discount &amp; COD Fee
              </Text>
              <Text as="p">
                This app runs inside Shopify Admin. Open it from{" "}
                <strong>Apps → Capped Discount &amp; COD Fee</strong> in your store
                admin.
              </Text>
              <Text as="p" tone="subdued">
                If you reached this page by accident, ask the store owner to open
                the app from their Shopify Admin.
              </Text>
            </BlockStack>
          </Card>
        </Box>
      </Page>
    </PolarisAppProvider>
  );
}

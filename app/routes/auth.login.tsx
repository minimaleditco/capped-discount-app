import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  Box,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { useState } from "react";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const errors = await login(request);
  return json(errors);
}

export async function action({ request }: ActionFunctionArgs) {
  const errors = await login(request);
  return json(errors);
}

export default function AuthLogin() {
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");

  return (
    <PolarisAppProvider i18n={enTranslations}>
      <Page narrowWidth>
        <Box paddingBlockStart="800">
          <Card>
            <Form method="post">
              <FormLayout>
                <Text variant="headingLg" as="h1">
                  Capped Percentage Discounts
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Enter your Shopify store domain to log in or install this app.
                </Text>
                <TextField
                  type="text"
                  name="shop"
                  label="Store URL"
                  placeholder="your-store-name.myshopify.com"
                  helpText="Example: saransh-discount-test.myshopify.com"
                  value={shop}
                  onChange={setShop}
                  autoComplete="on"
                  error={actionData?.shop}
                />
                <Button submit variant="primary" size="large">
                  Install / Launch App
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Box>
      </Page>
    </PolarisAppProvider>
  );
}

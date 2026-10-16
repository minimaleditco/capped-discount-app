import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import { Page, Card, FormLayout, TextField, Button, Text } from "@shopify/polaris";
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
    <Page>
      <Card>
        <Form method="post">
          <FormLayout>
            <Text variant="headingMd" as="h2">
              Log in to Shopify
            </Text>
            <TextField
              type="text"
              name="shop"
              label="Shop domain"
              helpText="e.g: my-shop-domain.myshopify.com"
              value={shop}
              onChange={setShop}
              autoComplete="on"
              error={actionData?.shop}
            />
            <Button submit variant="primary">
              Log in
            </Button>
          </FormLayout>
        </Form>
      </Card>
    </Page>
  );
}

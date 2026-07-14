import { useRouteError, isRouteErrorResponse } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
          <s-section heading="Log in">
            <s-text-field
              name="shop"
              label="Shop domain"
              details="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={errors.shop}
            ></s-text-field>
            <s-button type="submit">Log in</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}


export function ErrorBoundary() {
  const error = useRouteError();
  let message = "An unexpected error occurred during authentication.";
  if (isRouteErrorResponse(error)) {
    message = error.statusText || `Error ${error.status}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "40px", maxWidth: "500px", margin: "auto", textAlign: "center" }}>
      <h1 style={{ color: "#E02424" }}>Authentication Error</h1>
      <p style={{ marginTop: "2rem" }}>
        <button
          onClick={() => (window.location.href = "/app" + window.location.search)}
          style={{
            padding: "0.5rem 1rem",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Return Home
        </button>
      </p>
    </div>
  );
}


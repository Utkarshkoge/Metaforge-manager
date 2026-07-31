
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useRouteError, isRouteErrorResponse } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    return null;
  } catch (error) {
    // Shopify's authenticate.admin throws a redirect Response after OAuth callback.
    // We intercept it to ensure it redirects directly to our intended app UI (/app) 
    // instead of the root marketing page (/) to avoid double redirects.
    if (error instanceof Response && error.status === 302) {
      const location = error.headers.get("Location");
      if (location) {
        // If it's a relative redirect to /?shop=... or absolute to appUrl/?shop=...
        const url = new URL(location, "http://localhost");
        if (url.pathname === "/") {
          url.pathname = "/app";
          error.headers.set("Location", url.pathname + url.search);
        }
      }
    }
    throw error;
  }
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};


export function ErrorBoundary() {
  const error = useRouteError();
  let message = "An unexpected error occurred during auth setup.";
  if (isRouteErrorResponse(error)) {
    message = error.statusText || `Error ${error.status}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "40px", maxWidth: "500px", margin: "auto", textAlign: "center" }}>
      <h1 style={{ color: "#E02424" }}>Authentication Setup Error</h1>
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


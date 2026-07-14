import type { LinksFunction } from "react-router";
import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import tailwindStylesheetUrl from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: tailwindStylesheetUrl },
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
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
  const error = useRouteError();

  let errorMessage = "An unexpected error occurred";
  if (isRouteErrorResponse(error)) {
    errorMessage = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <div
          style={{
            padding: "2rem",
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "24px", marginBottom: "1rem" }}>
            Something went wrong
          </h1>

          <p>We were unable to load this page. Please try again, or return to the app home.</p>

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
        <Scripts />
      </body>
    </html>
  );
}
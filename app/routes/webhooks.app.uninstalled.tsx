import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  // We want to unconditionally delete all sessions for this shop
  // to enforce a new OAuth flow upon reinstall, satisfying Requirement 2.3.4.
  await db.session.deleteMany({ where: { shop } });

  // Shopify handles the billing cancellation automatically, but we should clear it locally
  // to prevent stale state if the user reinstalls within 48 hours before shop/redact fires.
  try {
    await db.activeSubscription.deleteMany({ where: { shopDomain: shop } });
  } catch (err) {
    console.error("Error clearing subscription on uninstall", err);
  }

  return new Response();
};

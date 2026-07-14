import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const shopDomain = session.shop;

    /* 1️⃣ Fetch active subscription */
    let dbActive = await prisma.activeSubscription.findUnique({
      where: { shopDomain },
      select: {
        popupShown: true,
      },
    });

    return {
      showPopup: dbActive?.popupShown || false,
    };
  } catch (error) {
    console.error("Error in api.checkPopup.subscription loader:", error);
    if (error instanceof Response) {
      throw error;
    }
    throw new Response("Internal Server Error", { status: 500 });
  }
};

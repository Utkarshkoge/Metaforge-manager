import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type PlanType = "FREE" | "BASIC" | "ADVANCED";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, admin, payload } = await authenticate.webhook(request);

    if (!admin) {
        return new Response("OK");
    }

    const dbActive = await prisma.activeSubscription.findUnique({
        where: { shopDomain: shop },
    });

    let shopifySub: {
        id: string;
        name: string;
        status: string;
        currentPeriodEnd?: string;
    } | null = null;

    try {
        const response = await admin.graphql(`
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
          }
        }
      }
    `);

        const data = await response.json();
        const activeSubs =
            data?.data?.currentAppInstallation?.activeSubscriptions ?? [];

        if (activeSubs.length > 0) {
            shopifySub = activeSubs[0]; // Shopify guarantees ONE active
        }
    } catch (err) {
        console.error("ActiveSubscriptions API failed", err);
        return new Response("OK");
    }

    let finalPlan: PlanType = "FREE";
    let finalSubscriptionId: string | null = null;
    let currentPeriodEndValue = new Date(0);

    if (shopifySub && shopifySub.status === "ACTIVE") {
        switch (shopifySub.name) {
            case "Basic":
                finalPlan = "BASIC";
                break;
            case "Advanced":
                finalPlan = "ADVANCED";
                break;
            default:
                finalPlan = "FREE";
        }

        finalSubscriptionId = shopifySub.id;
        if (shopifySub.currentPeriodEnd) {
            currentPeriodEndValue = new Date(shopifySub.currentPeriodEnd);
        }
    }

    const previousPlan: PlanType = dbActive?.plan ?? "FREE";

    const hasChanged = previousPlan !== finalPlan;

    if (!hasChanged) {
        return new Response("OK");
    }

    const showPopup = finalPlan !== "FREE" && previousPlan !== finalPlan;

    await prisma.activeSubscription.upsert({
        where: { shopDomain: shop },
        update: {
            plan: finalPlan,
            subscriptionId: finalSubscriptionId ?? "",
            popupShown: showPopup,
            currentPeriodEnd: currentPeriodEndValue,
        },
        create: {
            shopDomain: shop,
            plan: finalPlan,
            subscriptionId: finalSubscriptionId ?? "",
            popupShown: showPopup,
            currentPeriodEnd: currentPeriodEndValue,
        },
    });

    if (finalPlan === "ADVANCED") {
        const basicPlan = await prisma.basicPlanLimits.findUnique({
            where: { shopDomain: shop },
        });
        if (basicPlan) {
            await prisma.basicPlanLimits.delete({
                where: { shopDomain: shop },
            });
        }
    }

    return new Response("OK");
};

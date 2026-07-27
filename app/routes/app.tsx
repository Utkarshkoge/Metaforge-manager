import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import prisma from "../db.server";

async function syncFreeTrialDays(shopDomain: string, actualPlan: string, isFreeTrial: boolean, trialDaysLeft: number) {
  try {
    const limits = await prisma.freePlanLimits.findUnique({
      where: { shopDomain }
    });

    if (!limits) {
      const data = {
        shopDomain,
        basic: 3,
        advanced: 7
      };
      const updateData: any = {};
      if (isFreeTrial) {
        if (actualPlan === "BASIC") {
          data.basic = trialDaysLeft;
          updateData.basic = trialDaysLeft;
        } else if (actualPlan === "ADVANCED") {
          data.advanced = trialDaysLeft;
          updateData.advanced = trialDaysLeft;
        }
      }
      await prisma.freePlanLimits.upsert({
        where: { shopDomain },
        create: data,
        update: updateData
      });
      return;
    }

    let needsUpdate = false;
    let updateData: any = {};

    if (isFreeTrial) {
      if (actualPlan === "BASIC") {
        if (limits.basic !== trialDaysLeft && limits.basic > trialDaysLeft) {
          updateData.basic = trialDaysLeft;
          needsUpdate = true;
        }
      } else if (actualPlan === "ADVANCED") {
        if (limits.advanced !== trialDaysLeft && limits.advanced > trialDaysLeft) {
          updateData.advanced = trialDaysLeft;
          needsUpdate = true;
        }
      }
    } else {
      if (limits.basic !== 0 && actualPlan === "BASIC") {
        updateData.basic = 0;
        needsUpdate = true;
      }
      if (limits.advanced !== 0 && actualPlan === "ADVANCED") {
        updateData.advanced = 0;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.freePlanLimits.update({
        where: { shopDomain },
        data: updateData
      });
    }
  } catch (error) {
    console.error("Error syncing free trial days:", error);
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.admin(request);

    const shopDomain = session?.shop;

    try {
      await checkAndResetSubscription(shopDomain, prisma);
    } catch (checkError) {
      console.error("checkAndResetSubscription failed", checkError);
    }

    let active = null;
    let dbFailed = false;
    let actualPlan = "FREE";
    let displayPlan = "FREE";
    let time: Date | null = null;
    let remainingDays: number | null = null;
    let limits: any = null;

    try {
      active = await prisma.activeSubscription.findUnique({
        where: { shopDomain },
      });
    } catch (dbError) {
      console.error("DB failed to read activeSubscription", dbError);
      dbFailed = true;
    }

    if (active && !dbFailed) {
      actualPlan = active.plan ?? "FREE";
      time = active.currentPeriodEnd;
    } else {
      // Fallback to Shopify Subscription API if DB failed or active plan not present in DB
      try {
        const response = await admin.graphql(
          `#graphql
          query ActiveSubscriptionsForCurrentApp {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                status
                createdAt
                currentPeriodEnd
              }
            }
          }
          `
        );
        const responseJson = await response.json();
        const activeSubFromApi = responseJson.data?.currentAppInstallation?.activeSubscriptions?.find(
          (sub: any) => sub.status === "ACTIVE"
        );

        if (activeSubFromApi) {
          actualPlan = activeSubFromApi.name === "Basic" ? "BASIC" : activeSubFromApi.name === "Advanced" ? "ADVANCED" : "FREE";
          time = activeSubFromApi.currentPeriodEnd ? new Date(activeSubFromApi.currentPeriodEnd) : null;

          if (actualPlan !== 'FREE') {
            try {
              await prisma.activeSubscription.upsert({
                where: { shopDomain },
                update: {
                  plan: actualPlan as any,
                  subscriptionId: activeSubFromApi.id ?? "",
                  popupShown: false,
                  currentPeriodEnd: time ?? new Date(0),
                },
                create: {
                  shopDomain,
                  plan: actualPlan as any,
                  subscriptionId: activeSubFromApi.id ?? "",
                  popupShown: false,
                  currentPeriodEnd: time ?? new Date(0),
                },
              });
            } catch (dbUpsertError) {
              console.error("Failed to upsert activeSubscription from API fallback", dbUpsertError);
            }
          }
        }
      } catch (apiError) {
        console.error("Error querying active subscriptions via API:", apiError);
      }
    }

    // Calculate remaining days if plan is active
    if (actualPlan !== "FREE" && time) {
      const periodEnd = new Date(time);
      const today = new Date();
      const diffTime = periodEnd.getTime() - today.getTime();
      const calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      remainingDays = Math.max(0, calculatedDays);
    }

    // Determine plan name and limits to fetch based on remaining days (trial status)
    let limitsPlanToFetch = actualPlan;
    if (remainingDays !== null && remainingDays > 30) {
      displayPlan = "Free Trial Days";
      limitsPlanToFetch = "FREE";
      remainingDays = remainingDays - 30;
    } else {
      displayPlan = actualPlan;
    }

    // Sync Free Trial Days to DB if applicable
    if (shopDomain) {
      const isFreeTrial = displayPlan === "Free Trial Days";
      const trialDaysLeft = remainingDays || 0;
      await syncFreeTrialDays(shopDomain, actualPlan, isFreeTrial, trialDaysLeft);
    }

    // Fetch Limits
    try {
      if (limitsPlanToFetch === "FREE") {
        limits =
          (await prisma.freePlanLimits.findUnique({ where: { shopDomain } })) ??
          (await prisma.freePlanLimits.create({ data: { shopDomain } }));
      } else if (limitsPlanToFetch === "BASIC") {
        limits =
          (await prisma.basicPlanLimits.findUnique({ where: { shopDomain } })) ??
          (await prisma.basicPlanLimits.create({ data: { shopDomain } }));
      } else if (limitsPlanToFetch === "ADVANCED") {
        limits = Infinity;
      }
    } catch (dbLimitError) {
      console.error("DB failed to read/create limits", dbLimitError);
      dbFailed = true;
    }

    if (!limits || dbFailed) {
      limits = {
        tagGlobal: Infinity,
        metaGlobal: Infinity,
        metaRemoveCsvLimit: Infinity,
        metaUpdateCsvLimit: Infinity,
        tagAddCsvLimit: Infinity,
        tagRemoveCsvLimit: Infinity,
      };
    }

    return {
      apiKey: process.env.SHOPIFY_API_KEY!,
      planData: {
        plan: displayPlan,
        limits,
        remainingDays,
      },
    };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error("❌ Loader error:", error);

    throw new Response("Internal Server Error", {
      status: 500,
    });
  }
};

export default function App() {
  const { apiKey, planData } = useLoaderData<typeof loader>();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={translations}>
        <s-app-nav>
          <s-link href="/app/export-data">Export Data</s-link>
          <s-link href="/app/history">History</s-link>
          <s-link href="/app/billing/subscribe">Subscription Plans</s-link>
          <s-link href="/app/faq">FAQ</s-link>
        </s-app-nav>
        {/* 👇 provide plan globally */}
        <Outlet context={{ planData }} />
      </PolarisAppProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export async function checkAndResetSubscription(shopDomain: string, prisma: any) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  // Check active subscription end date
  const activeSub = await prisma.activeSubscription.findUnique({
    where: { shopDomain },
  });

  if (activeSub && activeSub.currentPeriodEnd) {
    if (new Date(activeSub.currentPeriodEnd) < new Date()) {
      await prisma.activeSubscription.deleteMany({
        where: { shopDomain: shopDomain }
      });
    }
  }

  /* ---------------- BASIC PLAN ---------------- */
  const basicPlan = await prisma.basicPlanLimits.findUnique({
    where: { shopDomain },
  });

  if (basicPlan && basicPlan.firstUsedAt) {
    if (basicPlan.firstUsedAt < oneMonthAgo) {
      await prisma.basicPlanLimits.delete({
        where: { shopDomain },
      });
    }
  }

  return { ok: true };
}


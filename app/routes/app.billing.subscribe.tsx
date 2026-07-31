import { LoaderFunctionArgs, ActionFunctionArgs, useNavigate, useLoaderData, useFetcher } from "react-router";
import { useEffect, useState } from "react";
import {
    Page,
    Layout,
    Card,
    Text,
    Button,
    BlockStack,
    Box,
    Badge,
    Grid,
    InlineStack,
    List,
    Divider,
    Icon,
    Modal,
    Banner
} from "@shopify/polaris";
import { HomeIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { RouteErrorBoundary } from "app/component/RouteErrorBoundary";

import {
    GET_RECURRING_APPLICATION_CHARGES,
    CANCEL_SUBSCRIPTION,
    CREATE_SUBSCRIPTION
} from "../graphql/subscriptionQueries";

export const PLANS = {
    BASIC: {
        name: "Basic",
        price: 5,
    },
    ADVANCED: {
        name: "Advanced",
        price: 10,
    },
} as const;

export type PlanKey = keyof typeof PLANS;

export async function loader({ request }: LoaderFunctionArgs) {
    try {
        const { session } = await authenticate.admin(request);
        const shopDomain = session.shop;

        const active = await prisma.activeSubscription.findUnique({
            where: { shopDomain },
            select: {
                plan: true,
                subscriptionId: true,
            },
        });

        const limits = await prisma.freePlanLimits.findUnique({
            where: { shopDomain },
            select: { basic: true, advanced: true }
        }) || { basic: 3, advanced: 7 };

        // Default to FREE if no active subscription
        const currentPlan = active?.plan ?? "FREE";

        return {
            currentPlan,
            subscriptionId: active?.subscriptionId ?? null,
            trialDays: {
                BASIC: limits.basic,
                ADVANCED: limits.advanced
            }
        };
    } catch (error) {
        console.error("Error in billing subscribe loader:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Internal Server Error", { status: 500 });
    }
}

export async function action({ request }: ActionFunctionArgs) {
    try {
        const { admin, session } = await authenticate.admin(request);
        const shop = session.shop;
        const isTest = process.env.SHOPIFY_BILLING_TEST === "true" || process.env.NODE_ENV !== "production";


        const url = new URL(request.url);
        const formData = await request.formData();
        const actionType = formData.get("actionType") || "SUBSCRIBE";

        if (actionType === "CANCEL") {
            // 1. Check active subscriptions from Shopify first to cancel the correct one
            const checkResponse = await admin.graphql(GET_RECURRING_APPLICATION_CHARGES);
            const checkData = await checkResponse.json();
            const activeSubscriptions = checkData.data?.currentAppInstallation?.activeSubscriptions || [];
            const activeSubscription = activeSubscriptions.find((sub: any) => sub.status === "ACTIVE" || sub.status === "ACCEPTED");

            if (activeSubscription) {
                const cancelResponse = await admin.graphql(
                    CANCEL_SUBSCRIPTION,
                    {
                        variables: {
                            id: activeSubscription.id,
                            prorate: true,
                        },
                    }
                );
                const cancelData = await cancelResponse.json();
                const cancelResult = cancelData.data?.appSubscriptionCancel;
                if (cancelResult?.userErrors?.length) {
                    throw new Response(
                        cancelResult.userErrors.map((e: any) => e.message).join(", "),
                        { status: 400 }
                    );
                }
            }

            const activeSubRecord = await prisma.activeSubscription.findUnique({ where: { shopDomain: shop } });
            const planToCancel = activeSubRecord?.plan;

            // Remove shop from ActiveSubscription if present
            await prisma.activeSubscription.deleteMany({
                where: { shopDomain: shop }
            });

            // Remove shop from BasicPlanLimits if present
            await prisma.basicPlanLimits.deleteMany({
                where: { shopDomain: shop }
            });

            if (planToCancel === "BASIC") {
                await prisma.freePlanLimits.updateMany({
                    where: { shopDomain: shop },
                    data: { basic: 0 }
                });
            } else if (planToCancel === "ADVANCED") {
                await prisma.freePlanLimits.updateMany({
                    where: { shopDomain: shop },
                    data: { advanced: 0 }
                });
            }

            return { success: true };
        } else {
            // ActionType is SUBSCRIBE
            let host = url.searchParams.get("host") || "";
            if (!host) {
                const hostUrl = `${shop}/admin`;
                host = Buffer.from(hostUrl).toString("base64");
            }

            const planKey = formData.get("plan") as PlanKey;
            const skipTrial = formData.get("skipTrial") === "true";
            const plan = PLANS[planKey];
            if (!plan) {
                throw new Response("Invalid plan", { status: 400 });
            }

            const returnUrl =
                `${process.env.SHOPIFY_APP_URL}/app` +
                `?shop=${shop}&host=${encodeURIComponent(host)}`;

            const trialDaysStr = formData.get("trialDays") as string;
            let trialDays = 0;

            if (!skipTrial && trialDaysStr) {
                trialDays = parseInt(trialDaysStr, 10);
                if (isNaN(trialDays)) trialDays = 0;
            }

            const variables: any = {
                name: plan.name,
                returnUrl,
                test: isTest,
                amount: plan.price,
                currency: "USD",
            };

            const activeSub = await prisma.activeSubscription.findUnique({
                where: { shopDomain: shop },
                select: { plan: true },
            });
            const currentPlan = activeSub?.plan ?? "FREE";

            if (currentPlan !== "FREE" && currentPlan !== planKey) {
                // Determine if upgrade or downgrade
                if (currentPlan === "BASIC" && planKey === "ADVANCED") {
                    variables.replacementBehavior = "APPLY_IMMEDIATELY";
                } else if (currentPlan === "ADVANCED" && planKey === "BASIC") {
                    variables.replacementBehavior = "STANDARD";
                } else {
                    variables.replacementBehavior = "STANDARD";
                }
            }

            if (trialDays > 0) {
                variables.trialDays = trialDays;
            }

            const graphqlResponse = await admin.graphql(
                CREATE_SUBSCRIPTION,
                { variables }
            );

            const data = await graphqlResponse.json();
            const result = data.data?.appSubscriptionCreate;

            if (!result) {
                throw new Response("Billing error", { status: 500 });
            }

            if (result.userErrors?.length) {
                throw new Response(
                    result.userErrors.map((e: any) => e.message).join(", "),
                    { status: 400 }
                );
            }

            return { confirmationUrl: result.confirmationUrl };

        }

    } catch (error) {
        console.error("Error in billing subscribe action:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Internal Server Error", { status: 500 });
    }
}

export default function BillingPage() {
    const { currentPlan, trialDays } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    const navigate = useNavigate();

    const hasTrial = trialDays.BASIC > 0 || trialDays.ADVANCED > 0;
    const colSpan = hasTrial
        ? { xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }
        : { xs: 6, sm: 6, md: 6, lg: 6, xl: 6 };

    // Cancellation Modal States
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState(false);
    const cancelLoading = fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "CANCEL";

    // Subscription Confirmation Modal States
    const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
    const [pendingPlan, setPendingPlan] = useState<PlanKey | null>(null);
    const [pendingSkipTrial, setPendingSkipTrial] = useState(false);

    const handleSubscribeClick = (plan: PlanKey, skipTrial: boolean = false) => {
        setPendingPlan(plan);
        setPendingSkipTrial(skipTrial);
        setSubscribeModalOpen(true);
    };

    const handleSubscribeConfirm = () => {
        if (pendingPlan) {
            fetcher.submit(
                {
                    plan: pendingPlan,
                    actionType: "SUBSCRIBE",
                    skipTrial: pendingSkipTrial ? "true" : "false",
                    trialDays: String(trialDays[pendingPlan] || 0)
                },
                {
                    method: "post",
                    action: "/app/billing/subscribe",
                }
            );
        }
        setSubscribeModalOpen(false);
    };

    const handleCancelConfirm = () => {
        fetcher.submit(
            { actionType: "CANCEL" },
            {
                method: "post",
                action: "/app/billing/subscribe",
            }
        );
    };

    useEffect(() => {
        if (fetcher.data) {
            if ("confirmationUrl" in fetcher.data) {
                const url = (fetcher.data as { confirmationUrl: string }).confirmationUrl;
                if (window.top) {
                    window.top.location.href = url;
                }
            } else if ("success" in fetcher.data && fetcher.data.success) {
                setCancelSuccess(true);
            }
        }
    }, [fetcher.data]);

    return (
        <Page>
            <div className="flex flex-col space-y-0.5 mb-5 rounded-sm">
                {/* Header Row */}
                <div className="flex items-center space-x-2">
                    {/* Home Icon Button */}
                    <button
                        onClick={() => navigate("/app")}
                        className="flex items-center cursor-pointer justify-center text-[#303030] hover:opacity-70 transition-opacity focus:outline-none"
                        aria-label="Go to Home"
                    >
                        <Icon source={HomeIcon} />
                    </button>

                    {/* Vertical Divider */}
                    <span
                        className="h-5 w-px bg-[#D2D2D2]"
                        aria-hidden="true"
                    />

                    {/* Title */}
                    <div className="text-xl font-bold leading-tight">
                        Subscription Plans
                    </div>
                </div>

                {/* Subtitle - Aligned to start under the Title text */}
                <Text as="p" variant="bodySm" tone="subdued">
                    Choose the best plan for your shop's growth.
                </Text>
            </div>
            <style>{`
                .pricing-grid {
                    display: grid;
                    gap: 1.25rem;
                    align-items: stretch;
                }
                @media (min-width: 768px) {
                    .pricing-grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                    .pricing-grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 767px) {
                    .pricing-grid { grid-template-columns: minmax(0, 1fr); }
                }
            `}</style>
            <Layout>
                <Layout.Section>
                    <div className={`pricing-grid ${hasTrial ? "cols-3" : "cols-2"}`}>
                        {/* ================= FREE PLAN ================= */}
                        {hasTrial && (
                            <div style={{
                                background: "linear-gradient(135deg, #fcfcfcff 0%, #fcfcfcff 100%)",
                                padding: "3px",
                                borderRadius: "16px",
                                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <div style={{
                                    background: "#ffffffff", // Matching the user's white style
                                    color: "#1a1d1aff",
                                    padding: "20px",
                                    borderRadius: "13px",
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column"
                                }}>
                                    <BlockStack gap="400">
                                        <BlockStack gap="200">
                                            <InlineStack align="space-between" gap="500">
                                                <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#1a1d1aff", margin: 0 }}>Trial Day Limits.</h2>
                                            </InlineStack>
                                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#6d7175", margin: 0, paddingTop: "4px" }}>
                                                Subscribe to any plan to get a free trial.
                                            </p>
                                        </BlockStack>

                                        <div style={{ height: "1px", backgroundColor: "rgba(0, 0, 0, 0.1)", margin: "8px 0" }} />

                                        <BlockStack gap="200">
                                            <div>
                                                <p style={{ fontSize: "14px", fontWeight: "500", color: "#1a1d1aff", margin: 0, paddingBottom: "2px" }}>Included Limits:</p>
                                            </div>
                                            <BlockStack gap="150">
                                                <DarkFeatureItem text="2 Global Tag Removal Actions" detail="40 items/run, max 2 tags" />
                                                <DarkFeatureItem text="2 Global Metafield Removal Actions" detail="100 items/run" />
                                                <DarkFeatureItem text="200 CSV Entries" />
                                                <DarkFeatureItem text="Export All Resources" />
                                            </BlockStack>
                                        </BlockStack>
                                    </BlockStack>

                                    <div style={{ marginTop: 'auto' }}>
                                        <Box paddingBlockStart="400">
                                            <BlockStack gap="400">
                                                <div style={{ height: "1px", backgroundColor: "rgba(0, 0, 0, 0.1)" }} />
                                                <p style={{ fontSize: "14px", color: "#6d7175", margin: 0, lineHeight: "1.5" }}>
                                                    Free limit will work on free trial days. When free trial days end, your subscription feature limit and days will start.
                                                </p>
                                            </BlockStack>
                                        </Box>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ================= BASIC PLAN ================= */}
                        <div style={{
                            background: "linear-gradient(135deg, #fcfcfcff 0%, #fcfcfcff 100%)",
                            padding: "3px",
                            borderRadius: "16px",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            <div style={{
                                background: "#ffffffff", // Deep slate background
                                color: "#ffffff",
                                padding: "20px",
                                borderRadius: "13px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <BlockStack gap="400">
                                    <BlockStack gap="200">
                                        <InlineStack align="space-between" gap="200">
                                            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#1a1d1aff", margin: 0 }}>Basic</h2>
                                            <InlineStack gap="100">
                                                {currentPlan === "BASIC" && <Badge tone="success">Active</Badge>}
                                                {currentPlan === "BASIC" && trialDays.BASIC > 0 && <Badge tone="info">{`Trial - ${trialDays.BASIC} days left`}</Badge>}
                                            </InlineStack>
                                        </InlineStack>
                                        <p style={{ fontSize: "24px", fontWeight: "700", color: "#1a1d1aff", margin: 0 }}>$5 <span style={{ fontSize: "14px", fontWeight: "normal", color: "#6d7175" }}>/ month</span></p>
                                    </BlockStack>

                                    <div style={{ height: "1px", backgroundColor: "rgba(0, 0, 0, 0.1)", margin: "8px 0" }} />

                                    <BlockStack gap="200">
                                        <div>
                                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#1a1d1aff", margin: 0, paddingBottom: "2px" }}>Monthly Limits:</p>
                                            {trialDays.BASIC > 0 && (
                                                <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>These limits start after the trial period ends.</p>
                                            )}
                                        </div>
                                        <BlockStack gap="150">
                                            <DarkFeatureItem
                                                text="20 Global Tag Removal Actions"
                                                detail="100 items/run action, max 10 tags"
                                            />

                                            <DarkFeatureItem
                                                text="20 Global Metafield Removal Actions"
                                                detail="250 items/run action"
                                            />

                                            <DarkFeatureItem
                                                text="3,000 CSV Entries"
                                            />
                                            <DarkFeatureItem text="Export All Resources" />
                                            <DarkFeatureItem text="Standard Support" />
                                        </BlockStack>
                                    </BlockStack>
                                </BlockStack>

                                <div style={{ marginTop: 'auto' }}>
                                    <Box paddingBlockStart="400">
                                        {currentPlan === "BASIC" ? (
                                            <BlockStack gap="200">
                                                <Button
                                                    variant="secondary"
                                                    fullWidth
                                                    disabled
                                                >
                                                    Current Plan
                                                </Button>
                                                <Box paddingBlockStart="100">
                                                    <button
                                                        onClick={() => setCancelModalOpen(true)}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "#e22424ff",
                                                            cursor: "pointer",
                                                            textDecoration: "underline",
                                                            width: "100%",
                                                            textAlign: "center",
                                                            padding: "8px 0",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                    >
                                                        {trialDays.BASIC > 0 ? "Cancel Trial" : "Cancel subscription"}
                                                    </button>
                                                </Box>
                                            </BlockStack>
                                        ) : (
                                            trialDays.BASIC > 0 ? (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="primary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("BASIC", false)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "BASIC" && fetcher.formData?.get("skipTrial") === "false"}
                                                    >
                                                        {`Subscribe with ${trialDays.BASIC}-day trial`}
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("BASIC", true)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "BASIC" && fetcher.formData?.get("skipTrial") === "true"}
                                                    >
                                                        {currentPlan === "ADVANCED" ? "Downgrade without trial" : "Subscribe without trial"}
                                                    </Button>
                                                    {trialDays.BASIC < 3 && (
                                                        <div style={{ textAlign: "center", fontSize: "12px", color: "#6d7175" }}>
                                                            You have already used {3 - trialDays.BASIC} trial {3 - trialDays.BASIC === 1 ? 'day' : 'days'}.
                                                        </div>
                                                    )}
                                                </BlockStack>
                                            ) : (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="primary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("BASIC", false)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "BASIC"}
                                                    >
                                                        {currentPlan === "ADVANCED" ? "Downgrade to Basic" : "Upgrade to Basic"}
                                                    </Button>
                                                    <div style={{ textAlign: "center", fontSize: "12px", color: "#1c1d1dff" }}>
                                                        You already have used the free trial for this plan.
                                                    </div>
                                                </BlockStack>
                                            )
                                        )}
                                    </Box>
                                </div>
                            </div>
                        </div>

                        {/* ================= ADVANCED PLAN ================= */}
                        {/* Highlighted Card for the Recommended Plan */}
                        <div style={{
                            background: "linear-gradient(135deg, #dfdb15ff 0%, #06a36fff 100%)",
                            padding: "3px",
                            borderRadius: "16px",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column"
                        }}>
                            <div style={{
                                background: "#ffffffff", // Deep slate background
                                color: "#ffffff",
                                padding: "20px",
                                borderRadius: "13px",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column"
                            }}>
                                <BlockStack gap="400">
                                    <BlockStack gap="200">
                                        <InlineStack align="space-between" gap="200">
                                            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#000000ff", margin: 0 }}>Advanced</h2>
                                            <InlineStack gap="100">
                                                {currentPlan === "ADVANCED" && <Badge tone="success">Active</Badge>}
                                                {currentPlan === "ADVANCED" && trialDays.ADVANCED > 0 && <Badge tone="info">{`Trial - ${trialDays.ADVANCED} days left`}</Badge>}
                                                <Badge tone="attention">Best Value</Badge>
                                            </InlineStack>
                                        </InlineStack>
                                        <p style={{ fontSize: "24px", fontWeight: "700", color: "#000000ff", margin: 0 }}>$10 <span style={{ fontSize: "14px", fontWeight: "normal", color: "#94a3b8" }}>/ month</span></p>
                                    </BlockStack>

                                    <div style={{ height: "1px", backgroundColor: "rgba(0, 0, 0, 1)", margin: "8px 0" }} />

                                    <BlockStack gap="200">
                                        <div>
                                            <p style={{ fontSize: "14px", fontWeight: "500", color: "#000000ff", margin: 0, paddingBottom: "2px" }}>Everything Unlimited:</p>
                                            {trialDays.ADVANCED > 0 && (
                                                <p style={{ fontSize: "12px", color: "#6d7175", margin: 0 }}>These limits start after the trial period ends.</p>
                                            )}
                                        </div>
                                        <BlockStack gap="150">
                                            <DarkFeatureItem text="Unlimited Tag Removal" detail="5,000 items/run, max 20 tags" />
                                            <DarkFeatureItem text="Unlimited Metafield Removal" detail="5,000 items/run" />
                                            <DarkFeatureItem text="Unlimited CSV Operations" detail="5,000 entries/run" />
                                            <DarkFeatureItem text="Export All Resources" />
                                            <DarkFeatureItem text="Priority Support" />
                                        </BlockStack>
                                    </BlockStack>
                                </BlockStack>

                                <div style={{ marginTop: 'auto' }}>
                                    <Box paddingBlockStart="400">
                                        {currentPlan === "ADVANCED" ? (
                                            <BlockStack gap="200">
                                                <Button
                                                    variant="secondary"
                                                    fullWidth
                                                    disabled
                                                >
                                                    Current Plan
                                                </Button>
                                                <Box paddingBlockStart="100">
                                                    <button
                                                        onClick={() => setCancelModalOpen(true)}
                                                        style={{
                                                            background: "none",
                                                            border: "none",
                                                            color: "#e22424ff",
                                                            cursor: "pointer",
                                                            textDecoration: "underline",
                                                            width: "100%",
                                                            textAlign: "center",
                                                            padding: "8px 0",
                                                            fontSize: "14px",
                                                            fontWeight: "500"
                                                        }}
                                                    >
                                                        {trialDays.ADVANCED > 0 ? "Cancel Trial" : "Cancel subscription"}
                                                    </button>
                                                </Box>
                                            </BlockStack>
                                        ) : (
                                            trialDays.ADVANCED > 0 ? (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="primary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("ADVANCED", false)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "ADVANCED" && fetcher.formData?.get("skipTrial") === "false"}
                                                    >
                                                        {`Subscribe with ${trialDays.ADVANCED}-day trial`}
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("ADVANCED", true)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "ADVANCED" && fetcher.formData?.get("skipTrial") === "true"}
                                                    >
                                                        Subscribe without trial
                                                    </Button>
                                                    {trialDays.ADVANCED < 7 && (
                                                        <div style={{ textAlign: "center", fontSize: "12px", color: "#6d7175" }}>
                                                            You have already used {7 - trialDays.ADVANCED} trial {7 - trialDays.ADVANCED === 1 ? 'day' : 'days'}.
                                                        </div>
                                                    )}
                                                </BlockStack>
                                            ) : (
                                                <BlockStack gap="200">
                                                    <Button
                                                        variant="primary"
                                                        fullWidth
                                                        onClick={() => handleSubscribeClick("ADVANCED", false)}
                                                        loading={fetcher.state === "submitting" && fetcher.formData?.get("plan") === "ADVANCED"}
                                                    >
                                                        Upgrade to Advanced
                                                    </Button>
                                                    <div style={{ textAlign: "center", fontSize: "12px", color: "#1c1d1dff" }}>
                                                        You already have used the free trial for this plan.
                                                    </div>
                                                </BlockStack>
                                            )
                                        )}
                                    </Box>
                                </div>
                            </div>
                        </div>
                    </div>
                </Layout.Section>
            </Layout >

            {/* Cancel/Downgrade Confirmation Modal */}
            <Modal
                open={cancelModalOpen}
                onClose={() => {
                    if (!cancelLoading) {
                        setCancelModalOpen(false);
                        setCancelSuccess(false);
                    }
                }
                }
                title={
                    cancelSuccess
                        ? "Subscription Cancelled"
                        : ((currentPlan === "BASIC" && trialDays.BASIC > 0) || (currentPlan === "ADVANCED" && trialDays.ADVANCED > 0))
                            ? "Cancel active trial days?"
                            : "Cancel subscription and downgrade?"
                }
                primaryAction={cancelSuccess ? {
                    content: 'Close',
                    onAction: () => {
                        setCancelModalOpen(false);
                        setCancelSuccess(false);
                    }
                } : {
                    content: 'Yes, Cancel Subscription',
                    onAction: handleCancelConfirm,
                    loading: cancelLoading,
                    destructive: true,
                }}
                secondaryActions={
                    cancelSuccess ? undefined : [
                        {
                            content: currentPlan === "ADVANCED" ? 'No, Keep Advance Plan' : 'No, Keep Basic Plan',
                            onAction: () => setCancelModalOpen(false),
                            disabled: cancelLoading,
                        },
                    ]
                }
            >
                <Modal.Section>
                    {cancelSuccess ? (
                        <BlockStack gap="400">
                            <Banner tone="success">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                    Your subscription has been cancelled. You don't have an active plan.
                                </Text>
                            </Banner>
                        </BlockStack>
                    ) : (
                        ((currentPlan === "BASIC" && trialDays.BASIC > 0) || (currentPlan === "ADVANCED" && trialDays.ADVANCED > 0)) ? (
                            <BlockStack gap="400">
                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd" fontWeight="medium">
                                        Your trial is currently active, and you haven't been charged yet.                                    </Text>
                                    <List type="bullet">
                                        <List.Item>
                                            You can cancel the current plan and subscribe to a plan without a trial.
                                        </List.Item>
                                        <List.Item>
                                            <strong>After cancelling, you will not be able to use these trial days again for this plan.</strong>
                                        </List.Item>
                                    </List>
                                </BlockStack>
                            </BlockStack>
                        ) : (
                            <BlockStack gap="400">
                                <Text as="p" tone="critical" fontWeight="semibold">
                                    Are you sure you want to cancel your subscription and downgrade to the FREE plan?
                                </Text>
                                <BlockStack gap="200">
                                    <Text as="p" variant="bodyMd" fontWeight="medium">
                                        Please review the following details before proceeding:
                                    </Text>
                                    <List type="bullet">
                                        <List.Item>
                                            You’ll immediately lose access to all {currentPlan === "ADVANCED" ? "ADVANCED" : "BASIC"} features provided by this app.
                                        </List.Item>
                                        <List.Item>
                                            <strong>You will lose any remaining trial period for this plan, and you cannot use this trial period again.</strong>
                                        </List.Item>
                                        <List.Item>
                                            Shopify will stop future charges for this subscription. Any billing adjustments (such as credits or refunds) are handled automatically by Shopify’s billing system.
                                        </List.Item>
                                        <List.Item>
                                            You can upgrade again at any time by re-activating the paid plan in this app.
                                        </List.Item>
                                        <List.Item>
                                            Your existing data and settings will remain in your account, but paid features will be disabled.
                                        </List.Item>
                                    </List>
                                </BlockStack>
                            </BlockStack>
                        )
                    )}
                </Modal.Section>
            </Modal>

            {/* Subscribe Confirmation Modal */}
            <Modal
                open={subscribeModalOpen}
                onClose={() => setSubscribeModalOpen(false)}
                title={`Subscribe to ${pendingPlan ? PLANS[pendingPlan].name : ""} Plan?`}
                primaryAction={{
                    content: "Confirm and Upgrade",
                    onAction: handleSubscribeConfirm,
                    loading: fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "SUBSCRIBE"
                }}
                secondaryActions={
                    [
                        {
                            content: "Cancel",
                            onAction: () => setSubscribeModalOpen(false)
                        }
                    ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <BlockStack gap="200">
                            <Text as="p">
                                Are you sure you want to subscribe to the <strong>{pendingPlan ? PLANS[pendingPlan].name : ""} Plan</strong> for <strong>${pendingPlan ? PLANS[pendingPlan].price : ""}/month</strong>?
                            </Text>

                        </BlockStack>
                        {currentPlan !== "FREE" && (
                            <BlockStack gap="300">
                                <Banner tone="warning">
                                    <Text as="p">
                                        You are currently subscribed to the <strong>{currentPlan}</strong> plan. Continuing will automatically switch your subscription to the <strong>{pendingPlan ? PLANS[pendingPlan].name : ""}</strong> plan.
                                    </Text>
                                </Banner>
                            </BlockStack>
                        )}
                        <BlockStack gap="300">
                            <List type="bullet">
                                {!pendingSkipTrial && pendingPlan && trialDays[pendingPlan] > 0 && (
                                    <List.Item>
                                        This subscription includes a <strong>{trialDays[pendingPlan]}-day free trial</strong>. You will not be charged until the trial period ends.
                                    </List.Item>
                                )}
                                {pendingSkipTrial && pendingPlan && trialDays[pendingPlan] > 0 && (
                                    <List.Item>
                                        <strong>Your remaining trial days will be cancelled.</strong> You won't be able to use trial days in the future for this plan, and the plan will start immediately without a trial.
                                    </List.Item>
                                )}
                                <List.Item>
                                    Shopify will automatically handle any applicable billing adjustments.
                                </List.Item>
                                <List.Item>
                                    Your existing data and settings will remain unchanged.
                                </List.Item>
                            </List>
                        </BlockStack>
                        <Text as="p" variant="bodyMd">
                            You will be redirected to Shopify's secure billing page to approve this charge.
                        </Text>
                    </BlockStack>
                </Modal.Section>
            </Modal >
        </Page >
    );
}

function DarkFeatureItem({ text, detail }: { text: string; detail?: string }) {
    return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ color: "#10b981", fontWeight: "bold", fontSize: "14px", lineHeight: "20px" }}>✓</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#0f0f0fff", fontSize: "14px", fontWeight: "500" }}>{text}</span>
                {detail && (
                    <span style={{ color: "#6d7175", fontSize: "12px" }}>
                        {detail}
                    </span>
                )}
            </div>
        </div>
    );
}

export function ErrorBoundary() {
    return <RouteErrorBoundary routeName="Billing Page" />;
}

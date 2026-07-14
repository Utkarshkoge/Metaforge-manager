import {
  useRouteError,
  useRevalidator,
  useNavigate,
} from "react-router";
import {
  Page,
  Layout,
  LegacyCard,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { useEffect } from "react";

interface RouteErrorBoundaryProps {
  routeName: string;
}

export function RouteErrorBoundary({
  routeName,
}: RouteErrorBoundaryProps) {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const navigate = useNavigate();

  useEffect(() => {
    // Keep detailed logs for developers only.
    console.error(`[Route Error] ${routeName}`, error);
  }, [error, routeName]);

  const handleRetry = () => {
    revalidator.revalidate();
  };

  const handleHome = () => {
    navigate("/app");
  };

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Banner
            tone="critical"
            title="Something went wrong"
          >
            <p>
              We couldn't complete your request. This may be due to a temporary network issue, a server problem. Please try again later.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <LegacyCard sectioned>
            <BlockStack gap="500">

              <Text as="h2" variant="headingLg">
                Sorry, something went wrong.
              </Text>

              <Text as="p" tone="subdued">
                An unexpected error occurred while loading this page.{" "}
                <Text as="span" fontWeight="semibold">
                  Please try again.
                </Text>{" "}
                If the problem persists,{" "}
                <Text as="span" fontWeight="semibold">
                  try again later
                </Text>{" "}
                or{" "}
                <Text as="span" fontWeight="semibold">
                  return to the home page.
                </Text>
              </Text>

              <InlineStack gap="300">
                <Button
                  variant="primary"
                  onClick={handleRetry}
                  loading={revalidator.state === "loading"}
                >
                  Try Again
                </Button>

                <Button onClick={handleHome}>
                  Go to Home
                </Button>
              </InlineStack>

            </BlockStack>
          </LegacyCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
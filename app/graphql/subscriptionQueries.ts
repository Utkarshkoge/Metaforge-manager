export const GET_RECURRING_APPLICATION_CHARGES = `#graphql
  query GetRecurringApplicationCharges {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

export const CANCEL_SUBSCRIPTION = `#graphql
  mutation CancelAdvancedPlan($id: ID!, $prorate: Boolean) {
    appSubscriptionCancel(id: $id, prorate: $prorate) {
      userErrors {
        field
        message
      }
      appSubscription {
        id
        status
      }
    }
  }
`;

export const CREATE_SUBSCRIPTION = `#graphql
  mutation CreateSubscription(
    $name: String!
    $returnUrl: URL!
    $test: Boolean!
    $amount: Decimal!
    $currency: CurrencyCode!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: $amount, currencyCode: $currency }
            interval: EVERY_30_DAYS
          }
        }
      }]
    ) {
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

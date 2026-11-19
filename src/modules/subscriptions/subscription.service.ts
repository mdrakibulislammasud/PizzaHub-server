import { UUID } from "mongodb";

import { client } from "../../config/db.js";
import { env } from "../../config/env.js";
import { getStripeClient } from "../../config/stripe.js";

interface VendorDocument {
  _id: UUID;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
}

interface TransactionDocument {
  vendorId: UUID;
  plan: "premium";
  amount: number;
  currency: string;
  stripeSessionId: string;
  stripeSubscriptionId?: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  createdAt: Date;
}

export class SubscriptionServiceError extends Error {
  constructor(
    message: string,
    public statusCode: 400 | 403 | 404 | 409 | 500
  ) {
    super(message);
    this.name = "SubscriptionServiceError";
  }
}

const getUsersCollection = () =>
  client.db(env.DB_NAME).collection<VendorDocument>("user");

const getTransactionsCollection = () =>
  client.db(env.DB_NAME).collection<TransactionDocument>("transactions");

export const ensureSubscriptionIndexes = async (): Promise<void> => {
  const transactions = getTransactionsCollection();

  await transactions.createIndex(
    { stripeSessionId: 1 },
    { unique: true, name: "unique_stripe_session" }
  );

  await transactions.createIndex(
    { vendorId: 1, createdAt: -1 },
    { name: "vendor_transactions" }
  );
};

export const createPremiumCheckoutSession = async (
  vendorId: string
): Promise<{ url: string; sessionId: string }> => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    throw new SubscriptionServiceError(
      "Stripe is not configured. Please try again later.",
      500
    );
  }

  let vendorObjectId: UUID;

  try {
    vendorObjectId = new UUID(vendorId);
  } catch {
    throw new SubscriptionServiceError("Invalid vendor account.", 400);
  }

  const vendor = await getUsersCollection().findOne({
    _id: vendorObjectId,
  });

  if (!vendor) {
    throw new SubscriptionServiceError("Vendor account not found.", 404);
  }

  if (vendor.role !== "vendor") {
    throw new SubscriptionServiceError(
      "Only vendors can purchase Premium subscriptions.",
      403
    );
  }

  if (vendor.isBlocked) {
    throw new SubscriptionServiceError(
      "Blocked vendors cannot purchase subscriptions.",
      403
    );
  }

  const hasActivePremium =
    vendor.subscriptionPlan === "premium" &&
    vendor.subscriptionExpiresAt instanceof Date &&
    vendor.subscriptionExpiresAt.getTime() > Date.now();

  if (hasActivePremium) {
    throw new SubscriptionServiceError(
      "Your Premium subscription is already active.",
      409
    );
  }

  const stripe = getStripeClient();

  const price = await stripe.prices.retrieve(env.STRIPE_PRICE_ID);

  if (!price.active || !price.recurring || price.unit_amount === null) {
    throw new SubscriptionServiceError(
      "The configured Stripe Price must be an active recurring price.",
      400
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: vendor.email,
    client_reference_id: vendorId,
    line_items: [
      {
        price: env.STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    metadata: {
      vendorId,
      plan: "premium",
    },
    subscription_data: {
      metadata: {
        vendorId,
        plan: "premium",
      },
    },
    success_url: `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel`,
  });

  if (!session.url) {
    throw new SubscriptionServiceError(
      "Unable to create the Stripe Checkout URL.",
      500
    );
  }

  try {
    await getTransactionsCollection().insertOne({
      vendorId: vendorObjectId,
      plan: "premium",
      amount: price.unit_amount,
      currency: price.currency,
      stripeSessionId: session.id,
      status: "pending",
      createdAt: new Date(),
    });
  } catch (error) {
    // Avoid leaving an unused Checkout Session open.
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch {
      // Preserve the original database error.
    }

    throw error;
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
};

export const handleSubscriptionWebhook = async (
  event: import("stripe").default.Event
): Promise<void> => {
  const stripe = getStripeClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").default.Checkout.Session;

    if (session.mode !== "subscription" || !session.subscription) {
      return;
    }

    const vendorId = session.metadata?.vendorId;

    if (
      !vendorId ||
      session.client_reference_id !== vendorId ||
      session.metadata?.plan !== "premium"
    ) {
      throw new Error("Invalid vendor metadata in Stripe Checkout Session.");
    }

    const vendorObjectId = new UUID(vendorId);

    const existingTransaction = await getTransactionsCollection().findOne({
      stripeSessionId: session.id,
      vendorId: vendorObjectId,
      plan: "premium",
      status: { $in: ["pending", "paid"] },
    });

    if (!existingTransaction) {
      throw new Error("Verified subscription transaction was not found.");
    }

    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return;
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!["active", "trialing"].includes(subscription.status)) {
      return;
    }

    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    if (!currentPeriodEnd) {
      throw new Error("Stripe subscription period end is unavailable.");
    }

    const transactionResult = await getTransactionsCollection().updateOne(
      {
        stripeSessionId: session.id,
        vendorId: vendorObjectId,
        status: { $in: ["pending", "paid"] },
      },
      {
        $set: {
          status: "paid",
          stripeSubscriptionId: subscriptionId,
        },
      }
    );

    if (transactionResult.matchedCount !== 1) {
      throw new Error("Subscription transaction could not be verified.");
    }

    const vendorResult = await getUsersCollection().updateOne(
      {
        _id: vendorObjectId,
        role: "vendor",
        isBlocked: false,
      },
      {
        $set: {
          subscriptionPlan: "premium",
          subscriptionExpiresAt: new Date(currentPeriodEnd * 1000),
        },
      }
    );

    if (vendorResult.matchedCount !== 1) {
      throw new Error("Eligible vendor account was not found.");
    }

    return;
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as import("stripe").default.Subscription;
    const vendorId = subscription.metadata?.vendorId;

    if (!vendorId) {
      throw new Error("Vendor ID is missing from subscription metadata.");
    }

    const vendorObjectId = new UUID(vendorId);

    const isActive =
      event.type === "customer.subscription.updated" &&
      ["active", "trialing"].includes(subscription.status);

    if (isActive) {
      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

      if (!currentPeriodEnd) {
        throw new Error("Stripe subscription period end is unavailable.");
      }

      await getUsersCollection().updateOne(
        {
          _id: vendorObjectId,
          role: "vendor",
          isBlocked: false,
        },
        {
          $set: {
            subscriptionPlan: "premium",
            subscriptionExpiresAt: new Date(currentPeriodEnd * 1000),
          },
        }
      );
    } else {
      await getUsersCollection().updateOne(
        {
          _id: vendorObjectId,
          role: "vendor",
        },
        {
          $set: {
            subscriptionPlan: "free",
            subscriptionExpiresAt: null,
          },
        }
      );
    }
  }
};


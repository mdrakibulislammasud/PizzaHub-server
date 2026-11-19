import type { Request, Response } from "express";
import Stripe from "stripe";

import { env } from "../../config/env.js";
import { getStripeClient } from "../../config/stripe.js";
import { handleSubscriptionWebhook } from "./subscription.service.js";

export const stripeWebhookController = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({
      success: false,
      message: "Stripe webhook is not configured.",
    });
    return;
  }

  const signature = req.headers["stripe-signature"];

  if (!signature || typeof signature !== "string") {
    res.status(400).json({
      success: false,
      message: "Missing Stripe signature.",
    });
    return;
  }

  let event: Stripe.Event;

  try {
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({
        success: false,
        message: "Webhook requires the original raw request body.",
      });
      return;
    }

    event = getStripeClient().webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe signature verification failed:", error);

    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature.",
    });
    return;
  }

  try {
    await handleSubscriptionWebhook(event);

    res.status(200).json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    // Stripe can retry when the server returns a 5xx response.
    res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};

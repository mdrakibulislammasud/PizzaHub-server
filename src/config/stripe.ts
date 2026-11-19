import Stripe from "stripe";
import { env } from "./env.js";

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Please configure the Stripe environment variables."
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

import type { Request, Response } from "express";

import {
  createPremiumCheckoutSession,
  SubscriptionServiceError,
} from "./subscription.service.js";

export const createCheckoutSessionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const vendorId = req.user?.id;

    if (!vendorId) {
      res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
      return;
    }

    const session = await createPremiumCheckoutSession(vendorId);

    res.status(200).json({
      success: true,
      message: "Premium checkout session created successfully.",
      data: session,
    });
  } catch (error) {
    if (error instanceof SubscriptionServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create checkout session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create checkout session.",
    });
  }
};

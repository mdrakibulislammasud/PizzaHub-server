import type { Request, Response } from "express";

import {
  getCustomerDashboardOverview,
  OrderServiceError,
} from "./order.service.js";

export const getCustomerDashboardOverviewController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const customerId = req.user?.id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const overview = await getCustomerDashboardOverview(customerId);

    res.status(200).json({
      success: true,
      message: "Customer dashboard overview retrieved successfully.",
      data: overview,
    });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Customer dashboard overview error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve customer dashboard overview.",
    });
  }
};

import type { Request, Response } from "express";

import {
  getVendorDashboardOverview,
  VendorDashboardServiceError,
} from "./vendor.service.js";

export const getVendorDashboardOverviewController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const vendorId = req.user?.id;

    if (!vendorId) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const overview = await getVendorDashboardOverview(vendorId);

    res.status(200).json({
      success: true,
      message: "Vendor dashboard overview retrieved successfully.",
      data: overview,
    });
  } catch (error) {
    if (error instanceof VendorDashboardServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Vendor dashboard overview error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve vendor dashboard overview.",
    });
  }
};

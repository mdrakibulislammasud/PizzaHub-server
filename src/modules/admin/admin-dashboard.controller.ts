import type { Request, Response } from "express";

import { getAdminDashboardStats } from "./admin-dashboard.service.js";

export const getAdminDashboardOverviewController = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const stats = await getAdminDashboardStats();

    res.status(200).json({
      success: true,
      message: "Admin dashboard overview retrieved successfully.",
      data: stats,
    });
  } catch (error) {
    console.error("Get admin dashboard overview error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve admin dashboard overview.",
    });
  }
};

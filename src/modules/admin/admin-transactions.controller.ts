import type { Request, Response } from "express";

import { getAdminTransactions } from "./admin-transactions.service.js";
import { adminTransactionQuerySchema } from "./admin-transactions.validation.js";

export const getAdminTransactionsController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validation = adminTransactionQuerySchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid transaction query parameters.",
        errors: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const result = await getAdminTransactions(validation.data);

    res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully.",
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin transactions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve transactions.",
    });
  }
};

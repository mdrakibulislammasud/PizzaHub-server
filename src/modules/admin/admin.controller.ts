import type { Request, Response } from "express";

import {
  AdminServiceError,
  getAdminUsers,
  updateUserBlockStatus,
} from "./admin.service.js";

import {
  adminUserQuerySchema,
  adminUserIdSchema,
  updateUserBlockStatusSchema,
} from "./admin.validation.js";

export const getAdminUsersController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validation = adminUserQuerySchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid user search or filter parameters.",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await getAdminUsers(validation.data);

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully.",
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin users error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve users.",
    });
  }
};

export const updateUserBlockStatusController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const idValidation = adminUserIdSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
      return;
    }

    const bodyValidation = updateUserBlockStatusSchema.safeParse(
      req.body,
    );

    if (!bodyValidation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid block status. Expected a boolean isBlocked value.",
        errors: bodyValidation.error.flatten(),
      });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const updatedUser = await updateUserBlockStatus(
      idValidation.data,
      req.user.id,
      bodyValidation.data.isBlocked,
    );

    res.status(200).json({
      success: true,
      message: bodyValidation.data.isBlocked
        ? "User blocked successfully."
        : "User unblocked successfully.",
      data: updatedUser,
    });
  } catch (error) {
    if (error instanceof AdminServiceError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Update user block status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update user status.",
    });
  }
};

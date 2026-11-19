import type { Request, Response } from "express";
import { updateProfileSchema } from "./profile.validation.js";
import { updateProfile } from "./profile.service.js";

export const updateProfileController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = req.user;

  if (!user?.id || (user.role !== "customer" && user.role !== "vendor")) {
    res.status(403).json({
      success: false,
      message: "Only customers and vendors can update their profiles.",
    });
    return;
  }

  const validation = updateProfileSchema.safeParse(req.body);

  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => ({
      field: issue.path.length ? issue.path.join(".") : "request",
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      message:
        "Invalid profile information. Role and subscription fields cannot be changed.",
      errors,
    });
    return;
  }

  if (user.role === "customer" && validation.data.businessName !== undefined) {
    res.status(403).json({
      success: false,
      message: "Customers cannot update a business name.",
    });
    return;
  }

  if (
    !validation.data.name &&
    !validation.data.businessName &&
    !req.file
  ) {
    res.status(400).json({
      success: false,
      message: "Please provide at least one profile field to update.",
    });
    return;
  }

  try {
    const updatedProfile = await updateProfile(
      user.id,
      user.role,
      validation.data,
      req.file,
    );

    if (!updatedProfile) {
      res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Profile update failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update profile. Please try again.",
    });
  }
};

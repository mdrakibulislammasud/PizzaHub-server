import { UUID } from "mongodb";
import type { Express } from "express";

import { connectDB } from "../../config/db.js";
import { env } from "../../config/env.js";
import type { UpdateProfileInput } from "./profile.validation.js";

interface ProfileUser {
  _id: UUID;
  name?: string;
  email?: string;
  image?: string | null;
  role?: "customer" | "vendor" | "admin";
  businessName?: string;
}

const uploadProfileImage = async (
  file: Express.Multer.File,
): Promise<string> => {
  if (!env.IMGBB_API_KEY) {
    throw new Error("Profile image upload is not configured.");
  }

  const body = new URLSearchParams({
    image: file.buffer.toString("base64"),
  });

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${env.IMGBB_API_KEY}`,
    {
      method: "POST",
      body,
    },
  );

  const result = (await response.json()) as {
    success?: boolean;
    data?: {
      url?: string;
    };
  };

  if (!response.ok || !result.success || !result.data?.url) {
    throw new Error("Unable to upload profile image.");
  }

  return result.data.url;
};

export const updateProfile = async (
  userId: string,
  role: "customer" | "vendor",
  input: UpdateProfileInput,
  imageFile?: Express.Multer.File,
) => {
  const db = await connectDB();
  const userCollection = db.collection<ProfileUser>("user");

  const updateData: Record<string, string> = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }

  if (role === "vendor" && input.businessName !== undefined) {
    updateData.businessName = input.businessName;
  }

  if (imageFile) {
    updateData.image = await uploadProfileImage(imageFile);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("Please provide at least one profile field to update.");
  }

  const result = await userCollection.findOneAndUpdate(
    { _id: new UUID(userId) },
    { $set: updateData },
    {
      returnDocument: "after",
      projection: {
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        businessName: 1,
      },
    },
  );

  if (!result) {
    return null;
  }

  return {
    id: result._id.toString(),
    name: result.name,
    email: result.email,
    image: result.image ?? null,
    role: result.role,
    ...(role === "vendor"
      ? { businessName: result.businessName ?? null }
      : {}),
  };
};

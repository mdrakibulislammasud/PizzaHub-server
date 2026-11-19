import { UUID, type Collection, type Filter } from "mongodb";

import { client } from "../../config/db.js";
import { env } from "../../config/env.js";

import type {
  AdminUser,
  AdminUserFilters,
  AdminUserListResult,
} from "./admin.interface.js";

interface AdminUserDocument {
  _id: UUID;
  name: string;
  email: string;
  image?: string | null;
  role: "customer" | "vendor" | "admin";
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan?: "free" | "premium";
  subscriptionExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminServiceError extends Error {
  constructor(
    message: string,
    public statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "AdminServiceError";
  }
}

const getUsersCollection = (): Collection<AdminUserDocument> =>
  client.db(env.DB_NAME).collection<AdminUserDocument>("user");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatAdminUser = (user: AdminUserDocument): AdminUser => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  image: user.image ?? null,
  role: user.role,
  isBlocked: user.isBlocked ?? false,
  ...(user.businessName !== undefined && {
    businessName: user.businessName,
  }),
  subscriptionPlan: user.subscriptionPlan ?? "free",
  subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getAdminUsers = async (
  filters: AdminUserFilters,
): Promise<AdminUserListResult> => {
  const collection = getUsersCollection();

  const query: Filter<AdminUserDocument> = {};

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.search) {
    const searchRegex = new RegExp(
      escapeRegex(filters.search),
      "i",
    );

    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [users, total] = await Promise.all([
    collection
      .find(query, {
        projection: {
          _id: 1,
          name: 1,
          email: 1,
          image: 1,
          role: 1,
          isBlocked: 1,
          businessName: 1,
          subscriptionPlan: 1,
          subscriptionExpiresAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .toArray(),

    collection.countDocuments(query),
  ]);

  return {
    users: users.map(formatAdminUser),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
};

export const updateUserBlockStatus = async (
  targetUserId: string,
  adminUserId: string,
  isBlocked: boolean,
): Promise<AdminUser> => {
  if (targetUserId === adminUserId) {
    throw new AdminServiceError(
      "You cannot block or unblock your own account.",
      403,
    );
  }

  const collection = getUsersCollection();
  const targetId = new UUID(targetUserId);

  const targetUser = await collection.findOne(
    { _id: targetId },
    {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );

  if (!targetUser) {
    throw new AdminServiceError("User not found.", 404);
  }

  if (targetUser.role === "admin") {
    throw new AdminServiceError(
      "Admin accounts cannot be blocked or unblocked through this endpoint.",
      403,
    );
  }

  if (targetUser.isBlocked === isBlocked) {
    throw new AdminServiceError(
      isBlocked
        ? "This user is already blocked."
        : "This user is already unblocked.",
      409,
    );
  }

  const result = await collection.updateOne(
    {
      _id: targetId,
      role: { $ne: "admin" },
      isBlocked: { $ne: isBlocked },
    },
    {
      $set: {
        isBlocked,
        updatedAt: new Date(),
      },
    },
  );

  if (result.modifiedCount !== 1) {
    throw new AdminServiceError(
      "User status could not be updated. Please refresh and try again.",
      409,
    );
  }

  const updatedUser = await collection.findOne(
    { _id: targetId },
    {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
        businessName: 1,
        subscriptionPlan: 1,
        subscriptionExpiresAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );

  if (!updatedUser) {
    throw new AdminServiceError("User not found.", 404);
  }

  return formatAdminUser(updatedUser);
};

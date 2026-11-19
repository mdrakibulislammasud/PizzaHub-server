import { ObjectId, UUID } from "mongodb";

import { client } from "../../config/db.js";
import { env } from "../../config/env.js";

import type { MenuItem, MenuCategory } from "./menu.interface.js";
import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "./menu.validation.js";

interface UserDocument {
  _id: UUID;
  role?: string;
  isBlocked?: boolean;
  subscriptionPlan?: string;
}

interface MenuItemDocument extends Omit<MenuItem, "_id"> {
  _id?: ObjectId;
}

interface GetMenuItemsOptions {
  search?: string;
  category?: MenuCategory;
  location?: string;
  sort?: "price-asc" | "price-desc";
  page?: number;
  limit?: number;
}

const menuCollection = () =>
  client.db(env.DB_NAME).collection<MenuItemDocument>("menuItems");

const usersCollection = () =>
  client.db(env.DB_NAME).collection<UserDocument>("user");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatMenuItem = (item: MenuItemDocument): MenuItem => ({
  ...item,
  _id: item._id?.toString(),
});

export const createMenuItem = async (
  vendorId: string,
  data: CreateMenuItemInput,
): Promise<MenuItem> => {
  const vendor = await usersCollection().findOne({
    _id: new UUID(vendorId),
  });

  if (!vendor || vendor.role !== "vendor") {
    throw new Error("Vendor account not found.");
  }

  if (vendor.isBlocked) {
    throw new Error("Blocked vendors cannot create menu items.");
  }

  const subscriptionPlan =
    vendor.subscriptionPlan === "premium" ? "premium" : "free";

  if (subscriptionPlan === "free") {
    const reservedSlots = await menuCollection().countDocuments({
      vendorId,
      status: { $in: ["pending", "approved"] },
    });

    if (reservedSlots >= 3) {
      throw new Error(
        "Free plan allows a maximum of 3 menu item listings. Upgrade to Premium for unlimited listings.",
      );
    }
  }

  const now = new Date();

  const newMenuItem: MenuItemDocument = {
    ...data,
    vendorId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const result = await menuCollection().insertOne(newMenuItem);

  const savedItem = await menuCollection().findOne({
    _id: result.insertedId,
  });

  if (!savedItem) {
    throw new Error("Failed to create menu item.");
  }

  return formatMenuItem(savedItem);
};

export const getPublicMenuItems = async (
  options: GetMenuItemsOptions = {},
) => {
  const {
    search,
    category,
    location,
    sort,
    page = 1,
    limit = 12,
  } = options;

  const filter: Record<string, unknown> = {
    status: "approved",
  };

  if (search?.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    filter.$or = [
      { itemName: searchRegex },
      { description: searchRegex },
    ];
  }

  if (category) {
    filter.category = category;
  }

  if (location?.trim()) {
    filter.location = {
      $regex: escapeRegex(location.trim()),
      $options: "i",
    };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

  const sortOption: Record<string, 1 | -1> =
    sort === "price-asc"
      ? { price: 1 }
      : sort === "price-desc"
        ? { price: -1 }
        : { createdAt: -1 };

  const [items, total] = await Promise.all([
    menuCollection()
      .find(filter)
      .sort(sortOption)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .toArray(),

    menuCollection().countDocuments(filter),
  ]);

  return {
    items: items.map(formatMenuItem),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

export const getPublicMenuItemById = async (
  id: string,
): Promise<MenuItem | null> => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const item = await menuCollection().findOne({
    _id: new ObjectId(id),
    status: "approved",
  });

  return item ? formatMenuItem(item) : null;
};

export const getVendorMenuItems = async (
  vendorId: string,
): Promise<MenuItem[]> => {
  const items = await menuCollection()
    .find({ vendorId })
    .sort({ createdAt: -1 })
    .toArray();

  return items.map(formatMenuItem);
};

export const updateVendorMenuItem = async (
  id: string,
  vendorId: string,
  data: UpdateMenuItemInput,
): Promise<MenuItem | null> => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const result = await menuCollection().updateOne(
    {
      _id: new ObjectId(id),
      vendorId,
    },
    {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return null;
  }

  const updatedItem = await menuCollection().findOne({
    _id: new ObjectId(id),
    vendorId,
  });

  return updatedItem ? formatMenuItem(updatedItem) : null;
};

export const deleteVendorMenuItem = async (
  id: string,
  vendorId: string,
): Promise<boolean> => {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const result = await menuCollection().deleteOne({
    _id: new ObjectId(id),
    vendorId,
  });

  return result.deletedCount > 0;
};

// ==========================================
// ADMIN MENU MANAGEMENT
// ==========================================


export const getAllMenuItemsForAdmin = async (): Promise<MenuItem[]> => {
  const items = await menuCollection()
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return items.map(formatMenuItem);
};

export const updateMenuItemStatus = async (
  id: string,
  status: MenuItem["status"],
): Promise<MenuItem | null> => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const result = await menuCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return null;
  }

  const updatedItem = await menuCollection().findOne({
    _id: new ObjectId(id),
  });

  return updatedItem ? formatMenuItem(updatedItem) : null;
};

export const deleteMenuItemByAdmin = async (
  id: string,
): Promise<boolean> => {
  if (!ObjectId.isValid(id)) {
    return false;
  }

  const result = await menuCollection().deleteOne({
    _id: new ObjectId(id),
  });

  return result.deletedCount > 0;
};

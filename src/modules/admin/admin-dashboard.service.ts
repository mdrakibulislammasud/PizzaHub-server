import { client } from "../../config/db.js";
import { env } from "../../config/env.js";

import type { AdminDashboardStats } from "./admin-dashboard.interface.js";

export const getAdminDashboardStats =
  async (): Promise<AdminDashboardStats> => {
    const database = client.db(env.DB_NAME);

    const users = database.collection("user");
    const menuItems = database.collection("menuItems");
    const transactions = database.collection("transactions");

    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalMenuItems,
      pendingMenuItems,
      totalTransactions,
    ] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ role: "vendor" }),
      users.countDocuments({ role: "customer" }),
      menuItems.countDocuments({}),
      menuItems.countDocuments({ status: "pending" }),
      transactions.countDocuments({}),
    ]);

    return {
      totalUsers,
      totalVendors,
      totalCustomers,
      totalMenuItems,
      pendingMenuItems,
      totalTransactions,
    };
  };

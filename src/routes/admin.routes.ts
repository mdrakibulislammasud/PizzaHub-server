import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

import {
  getAdminUsersController,
  updateUserBlockStatusController,
} from "../modules/admin/admin.controller.js";

import { getAdminDashboardOverviewController } from "../modules/admin/admin-dashboard.controller.js";
import { getAdminTransactionsController } from "../modules/admin/admin-transactions.controller.js";

import {
  getAllMenuItemsForAdminController,
  updateMenuItemStatusController,
  deleteMenuItemByAdminController,
} from "../modules/menu/menu.controller.js";

const router = Router();

// All routes require an authenticated Admin.
router.use(verifyToken, authorizeRoles("admin"));

// Admin dashboard overview.
router.get("/overview", getAdminDashboardOverviewController);

// User management.
router.get("/users", getAdminUsersController);
router.patch("/users/:id/block", updateUserBlockStatusController);

// Transaction management (read-only).
router.get("/transactions", getAdminTransactionsController);

// Menu item management.
router.get("/menu-items", getAllMenuItemsForAdminController);
router.patch("/menu-items/:id/status", updateMenuItemStatusController);
router.delete("/menu-items/:id", deleteMenuItemByAdminController);

export default router;

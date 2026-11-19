import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

import {
  getAdminUsersController,
  updateUserBlockStatusController,
} from "../modules/admin/admin.controller.js";

import { getAdminDashboardOverviewController } from "../modules/admin/admin-dashboard.controller.js";

import { getAdminTransactionsController } from "../modules/admin/admin-transactions.controller.js";

const router = Router();

// All routes require an authenticated Admin.
router.use(verifyToken, authorizeRoles("admin"));

// Admin dashboard overview.
router.get("/overview", getAdminDashboardOverviewController);

// Get users with search, role filter and pagination.
router.get("/users", getAdminUsersController);

// Block or unblock a user.
router.patch(
  "/users/:id/block",
  updateUserBlockStatusController,
);

// View transactions with search, status filter and pagination.
// Read-only: no payment modification endpoints.
router.get("/transactions", getAdminTransactionsController);

export default router;

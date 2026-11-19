import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

import {
  getAdminUsersController,
  updateUserBlockStatusController,
} from "../modules/admin/admin.controller.js";

const router = Router();

// All routes require an authenticated Admin.
router.use(verifyToken, authorizeRoles("admin"));

// Get users with search, role filter and pagination.
router.get("/users", getAdminUsersController);

// Block or unblock a user.
router.patch(
  "/users/:id/block",
  updateUserBlockStatusController,
);

export default router;

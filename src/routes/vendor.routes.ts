import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

import { getVendorDashboardOverviewController } from "../modules/vendor/vendor.controller.js";

const router = Router();

// All vendor routes require an authenticated Vendor.
router.use(verifyToken, authorizeRoles("vendor"));

// Vendor dashboard overview.
router.get("/overview", getVendorDashboardOverviewController);

export default router;

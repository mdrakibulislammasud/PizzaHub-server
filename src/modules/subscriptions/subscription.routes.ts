import { Router } from "express";

import { verifyToken } from "../../middleware/verifyToken.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

import {
  createCheckoutSessionController,
} from "./subscription.controller.js";

const router = Router();

// Vendor Premium Checkout
router.post(
  "/checkout",
  verifyToken,
  authorizeRoles("vendor"),
  createCheckoutSessionController
);

export default router;

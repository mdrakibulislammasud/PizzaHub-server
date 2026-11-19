import { Router } from "express";

import { verifyToken } from "../middleware/verifyToken.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
import { uploadMenuImage } from "../middleware/upload.middleware.js";
import { updateProfileController } from "../modules/profile/profile.controller.js";

const router = Router();

router.patch(
  "/",
  verifyToken,
  authorizeRoles("customer", "vendor"),
  uploadMenuImage,
  updateProfileController,
);

export default router;

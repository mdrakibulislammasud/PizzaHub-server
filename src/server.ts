
import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth.js";
import { connectDB } from "./config/db.js";
import { verifyToken } from "./middleware/verifyToken.js";
import { authorizeRoles } from "./middleware/authorizeRoles.js";
import menuRoutes from "./routes/menu.routes.js";
import orderRoutes from "./modules/orders/order.routes.js";
import { ensureOrderIndexes } from "./modules/orders/order.service.js";

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// CORS Configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Better Auth Routes
app.all("/api/auth/*splat", toNodeHandler(auth));

// JSON Body Parser
app.use(express.json());

// Menu API Routes
app.use("/api/menu", menuRoutes);

// Order API Routes
app.use("/api/orders", orderRoutes);

// JWT Verification Test
app.get("/api/protected", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authenticated API access granted!",
    user: req.user,
  });
});

// Customer-only API
app.get(
  "/api/customer-only",
  verifyToken,
  authorizeRoles("customer"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Customer access granted!",
    });
  }
);

// Vendor-only API
app.get(
  "/api/vendor-only",
  verifyToken,
  authorizeRoles("vendor"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Vendor access granted!",
    });
  }
);

// Admin-only API
app.get(
  "/api/admin-only",
  verifyToken,
  authorizeRoles("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Admin access granted!",
    });
  }
);

// Health Check
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "PizzaHub API is running!",
  });
});

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    await ensureOrderIndexes();
    console.log("Order indexes initialized successfully.");

    app.listen(PORT, () => {
      console.log(`PizzaHub server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start PizzaHub server:", error);
    process.exit(1);
  }
};

void startServer();




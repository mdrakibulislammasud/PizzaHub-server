
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "PizzaHub API is running!",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`PizzaHub server running on port ${PORT}`);
});

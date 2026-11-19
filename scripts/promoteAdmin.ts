
import "dotenv/config";

import { createInterface } from "node:readline";

import { connectDB, client } from "../src/config/db.js";

type UserRole = "customer" | "vendor" | "admin";

interface DatabaseUser {
  _id: unknown;
  email: string;
  role?: UserRole;
  isBlocked?: boolean;
}

const promoteAdmin = async (): Promise<void> => {
  let exitCode = 0;

  try {
    console.log("\n=== PizzaHub Admin Bootstrap ===\n");

    // Step 1: Validate admin email
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!email) {
      throw new Error(
        "ADMIN_EMAIL is missing from environment variables."
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("ADMIN_EMAIL format is invalid.");
    }

    // Step 2: Connect to MongoDB
    const db = await connectDB();

    const usersCollection =
      db.collection<DatabaseUser>("user");

    // Step 3: Find existing user
    const user = await usersCollection.findOne({ email });

    if (!user) {
      throw new Error(
        "User not found. Register this email as a regular account first."
      );
    }

    // Step 4: Check existing Admin status
    if (user.role === "admin") {
      console.log("This account is already an Admin.");
      return;
    }

    // Step 5: Validate account status and role
    if (user.isBlocked === true) {
      throw new Error("A blocked account cannot be promoted.");
    }

    if (user.role !== "customer" && user.role !== "vendor") {
      throw new Error("This account has an invalid role.");
    }

    console.log("Account found:");
    console.log("Email:", email);
    console.log("Current role:", user.role);

    // Step 6: Ask for confirmation
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let confirmation: string;

    try {
      confirmation = await new Promise<string>((resolve) => {
        rl.question(
          '\nType "PROMOTE" to confirm Admin access: ',
          (answer) => resolve(answer)
        );
      });
    } finally {
      rl.close();
    }

    if (confirmation.trim() !== "PROMOTE") {
      console.log("\nAdmin promotion cancelled.");
      return;
    }

    // Step 7: Promote account safely
    const result = await usersCollection.updateOne(
      {
        _id: user._id,
        role: user.role,
        isBlocked: { $ne: true },
      },
      {
        $set: {
          role: "admin",
        },
      }
    );

    if (result.modifiedCount !== 1) {
      throw new Error(
        "Admin promotion failed. The account may have changed."
      );
    }

    console.log("\nAdmin role assigned successfully!");
    console.log("Admin email:", email);
  } catch (error) {
    exitCode = 1;

    console.error("\nAdmin Bootstrap failed:");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("An unexpected error occurred.");
    }
  } finally {
    try {
      await client.close();
      console.log("\nDatabase connection closed.");
    } catch (error) {
      exitCode = 1;
      console.error("\nFailed to close database connection:", error);
    }

    process.exitCode = exitCode;
  }
};

void promoteAdmin();

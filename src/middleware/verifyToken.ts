
import type { Request, Response, NextFunction } from "express";
import type { JWTPayload } from "jose";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { UUID } from "mongodb";

import { env } from "../config/env.js";
import { connectDB } from "../config/db.js";

type UserRole = "customer" | "vendor" | "admin";

interface AuthPayload extends JWTPayload {
  id: string;
  email: string;
  role?: UserRole;
  isBlocked?: boolean;
}

interface DatabaseUser {
  _id: UUID;
  role?: UserRole;
  isBlocked?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWKS = createRemoteJWKSet(
  new URL(`${env.BETTER_AUTH_URL}/api/auth/jwks`)
);

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Authentication token is required.",
    });
    return;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Authentication token is missing.",
    });
    return;
  }

  let payload: AuthPayload;

  // Step 1: Verify JWT signature, issuer, audience and expiration.
  try {
    const result = await jwtVerify(token, JWKS, {
      issuer: env.BETTER_AUTH_URL,
      audience: env.BETTER_AUTH_URL,
    });

    const decoded = result.payload;

    if (
      typeof decoded.id !== "string" ||
      typeof decoded.email !== "string"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token payload.",
      });
      return;
    }

    payload = decoded as AuthPayload;
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
    return;
  }

  // Step 2: Validate the user ID.
  let userId: UUID;

  try {
    userId = new UUID(payload.id);
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid user ID.",
    });
    return;
  }

  // Step 3: Verify the user's current database status.
  try {
    const db = await connectDB();

    const user = await db
      .collection<DatabaseUser>("user")
      .findOne(
        { _id: userId },
        {
          projection: {
            role: 1,
            isBlocked: 1,
          },
        }
      );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found.",
      });
      return;
    }

    if (user.isBlocked === true) {
      res.status(403).json({
        success: false,
        message: "Your account has been blocked.",
      });
      return;
    }

    if (
      user.role !== "customer" &&
      user.role !== "vendor" &&
      user.role !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "Invalid account role.",
      });
      return;
    }

    // Always trust the current database role, not the JWT role.
    req.user = {
      ...payload,
      role: user.role,
      isBlocked: user.isBlocked ?? false,
    };

    next();
  } catch (error) {
    console.error("Authentication database check failed.");

    res.status(500).json({
      success: false,
      message: "Unable to verify your account. Please try again.",
    });
  }
};

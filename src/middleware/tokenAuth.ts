import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

// Payload shape signed by loginUserController (src/AllTables/Auth/auth.controller.ts)
export type AuthPayload = {
  sub: number;
  userId: number;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "user";
  exp?: number;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// Verifies "Authorization: Bearer <token>" and attaches the decoded payload to req.user.
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or malformed Authorization header" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "JWT_SECRET is not defined in the environment variables" });
    return;
  }

  try {
    req.user = jwt.verify(header.slice(7), secret) as unknown as AuthPayload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// For routes that work for both guests and logged-in users (e.g. checkout).
// Decodes and attaches req.user when a valid Bearer token is present; never
// rejects the request for a missing/invalid token — it just proceeds guest.
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (header && header.startsWith("Bearer ") && secret) {
    try {
      req.user = jwt.verify(header.slice(7), secret) as unknown as AuthPayload;
    } catch {
      // Invalid/expired token on an optional-auth route: proceed as guest
      // rather than failing the request.
    }
  }

  next();
};

// Assumes requireAuth already ran — chain them: requireAuth, requireAdmin.
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  next();
};
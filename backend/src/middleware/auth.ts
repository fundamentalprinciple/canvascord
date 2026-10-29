import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!token || !secret) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || !payload.sub) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

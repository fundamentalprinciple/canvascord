import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { CookieOptions } from "express";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE_NAME = "canvascord_refresh";

export function createAccessToken(userId: string): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET is not configured correctly");
  }

  return jwt.sign({}, secret, {
    subject: userId,
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function createRefreshToken(userId: string, sessionId: string): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET is not configured correctly");
  }

  return jwt.sign({}, secret, {
    subject: userId,
    jwtid: sessionId,
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyRefreshToken(token: string): jwt.JwtPayload {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET is not configured correctly");
  }

  const payload = jwt.verify(token, secret);

  if (typeof payload === "string" || !payload.sub || !payload.jti) {
    throw new Error("Invalid refresh token");
  }

  return payload;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: REFRESH_TOKEN_TTL_MS,
};

import { Router } from "express";
import { validateRequest } from "../middleware/validateRequest.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { RefreshSession } from "../models/RefreshSession.js";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  verifyRefreshToken,
} from "../utils/authTokens.js";

const router = Router();

router.post(
  "/register",
  validateRequest(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { username, email, password } = res.locals.validated.body;

      if (
        !process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_ACCESS_SECRET.length < 32
      ) {
        res.status(500).json({ error: "Authentication is not configured" });
        return;
      }

      const existing = await User.findOne({
        $or: [{ username }, { email }],
      }).lean();

      if (existing) {
        res
          .status(409)
          .json({ error: "Username or email is already registered" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ username, email, passwordHash });

      const accessToken = createAccessToken(user.id);
      const session = await RefreshSession.create({
        user: user._id,
        tokenHash: "pending",
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      });

      const refreshToken = createRefreshToken(user.id, session.id);
      session.tokenHash = hashRefreshToken(refreshToken);
      await session.save();

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
      res.status(201).json({
        token: accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        res
          .status(409)
          .json({ error: "Username or email is already registered" });
        return;
      }

      console.error("Registration failed:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  },
);

router.post(
  "/login",
  validateRequest(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { identifier, password } = res.locals.validated.body;

      const user = await User.findOne({
        $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
      }).select("+passwordHash");

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const accessToken = createAccessToken(user.id);
      const session = await RefreshSession.create({
        user: user._id,
        tokenHash: "pending",
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      });

      const refreshToken = createRefreshToken(user.id, session.id);
      session.tokenHash = hashRefreshToken(refreshToken);
      await session.save();

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
      res.json({
        token: accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      console.error("Login failed:", error);
      res.status(500).json({ error: "Login failed" });
    }
  },
);

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (typeof token !== "string") {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    const payload = verifyRefreshToken(token);
    const now = new Date();

    const session = await RefreshSession.findOneAndUpdate(
      {
        _id: payload.jti,
        user: payload.sub,
        tokenHash: hashRefreshToken(token),
        revokedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          tokenHash: "rotating",
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      },
      { returnDocument: "after" },
    );

    if (!session) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const user = await User.findById(session.user);

    if (!user) {
      session.revokedAt = new Date();
      await session.save();
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const nextRefreshToken = createRefreshToken(user.id, session.id);

    const updated = await RefreshSession.updateOne(
      { _id: session._id, tokenHash: "rotating" },
      { $set: { tokenHash: hashRefreshToken(nextRefreshToken) } },
    );

    if (updated.modifiedCount !== 1) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    res.cookie(REFRESH_COOKIE_NAME, nextRefreshToken, refreshCookieOptions);
    res.json({ token: createAccessToken(user.id) });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof token === "string") {
    try {
      const payload = verifyRefreshToken(token);
      const session = await RefreshSession.findById(payload.jti);

      if (
        session &&
        !session.revokedAt &&
        session.user.toString() === payload.sub &&
        session.tokenHash === hashRefreshToken(token)
      ) {
        session.revokedAt = new Date();
        await session.save();
      }
    } catch {
      // Invalid or expired cookies are still cleared below.
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
  res.json({ message: "Logged out successfully" });
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).lean();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch {
    res.status(500).json({ error: "Could not retrieve profile" });
  }
});

export default router;

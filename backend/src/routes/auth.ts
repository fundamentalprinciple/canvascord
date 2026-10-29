import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

function createAccessToken(userId: string): string | null {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) return null;

  return jwt.sign({}, secret, {
    subject: userId,
    expiresIn: "15m",
  });
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const username =
      typeof req.body.username === "string" ? req.body.username.trim() : "";
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      res.status(400).json({
        error:
          "Username must be 3–32 characters: letters, numbers, underscores",
      });
      return;
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "A valid email is required" });
      return;
    }

    if (password.length < 12 || password.length > 128) {
      res.status(400).json({
        error: "Password must be between 12 and 128 characters",
      });
      return;
    }

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
    const token = createAccessToken(user.id);

    if (!token) {
      res.status(500).json({ error: "Authentication is not configured" });
      return;
    }

    res.status(201).json({
      token,
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
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const identifier =
      typeof req.body.identifier === "string" ? req.body.identifier.trim() : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";

    if (!identifier || !password) {
      res.status(400).json({ error: "Identifier and password are required" });
      return;
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = createAccessToken(user.id);
    if (!token) {
      res.status(500).json({ error: "Authentication is not configured" });
      return;
    }

    res.json({
      token,
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

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import authRoutes from "./routes/auth.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "canvascord-backend" });
});

export default app;
app.use(
  (
    error: Error & { status?: number; type?: string },
    _req: Request,
    res: Response,
    _next: (error?: Error) => void,
  ) => {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }

    console.error("Request error:", error);
    res.status(error.status ?? 500).json({
      error:
        error.status && error.status < 500
          ? "Invalid request"
          : "Internal server error",
    });
  },
);

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import type { Request, Response, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.js";
import channelRoutes from "./routes/channels.js";

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
app.use("/api/channels", channelRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "canvascord-backend" });
});

export default app;

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

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
};

app.use(errorHandler);

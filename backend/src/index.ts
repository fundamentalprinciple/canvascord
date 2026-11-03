import "dotenv/config";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import { connectDatabase } from "./config/database.js";
import authRoutes from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT) || 8000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "16kb" }));
app.use("/api/auth", authRoutes);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "canvascord-backend" });
});

async function startServer() {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`CanvasCord backend running on port ${PORT}`);
    });

    let isShuttingDown = false;

    async function shutdown(signal: string) {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`${signal} received. Shutting down gracefully...`);

      server.close(async (error) => {
        if (error) {
          console.error("HTTP server shutdown failed:", error);
          process.exitCode = 1;
        }

        try {
          const mongoose = await import("mongoose");
          await mongoose.default.connection.close();
          console.log("MongoDB connection closed");
        } catch (shutdownError) {
          console.error("MongoDB shutdown failed:", shutdownError);
          process.exitCode = 1;
        }
      });
    }

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

void startServer();

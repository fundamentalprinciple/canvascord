import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";

const PORT = Number(process.env.PORT) || 8000;

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

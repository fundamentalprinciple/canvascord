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
    app.listen(PORT, () => {
      console.log(`CanvasCord backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

void startServer();

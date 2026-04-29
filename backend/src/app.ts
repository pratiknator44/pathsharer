import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { dbHealthCheck } from "./database/connection";
import { errorHandler } from "./middlewares/error.middleware";
import { requestLogger } from "./middlewares/logger.middleware";
import router from "./routes";

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Body parsing
app.use(express.json({ limit: "100kb" }));

// Request logging
app.use(requestLogger);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", db: dbHealthCheck() });
});

// API routes
app.use("/api/v1", router);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Central error handler — must be last
app.use(errorHandler);

export default app;

import { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { ZodError } from "zod";
import { env } from "../config/env";

interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: err.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // MongoDB duplicate key
  if (err instanceof MongoServerError && err.code === 11000) {
    res.status(409).json({ error: "Duplicate value — resource already exists" });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message =
    statusCode < 500 || env.NODE_ENV !== "production"
      ? err.message
      : "Internal server error";

  res.status(statusCode).json({ error: message });
}

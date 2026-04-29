import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (env.NODE_ENV !== "test") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
}

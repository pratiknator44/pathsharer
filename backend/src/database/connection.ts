import mongoose from "mongoose";
import { env } from "../config/env";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  isConnected = true;
  console.log("[DB] MongoDB connected");

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("[DB] MongoDB disconnected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[DB] MongoDB error:", err);
  });
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log("[DB] MongoDB disconnected gracefully");
}

export function dbHealthCheck(): { status: string; connected: boolean } {
  return {
    status: mongoose.connection.readyState === 1 ? "ok" : "degraded",
    connected: mongoose.connection.readyState === 1,
  };
}

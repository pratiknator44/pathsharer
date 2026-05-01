import { createClient } from "redis";
import { env } from "../config/env";

// Shared client instance — call connectRedis() before using it
export const redisClient = createClient({
  url: env.REDIS_URL ?? "redis://localhost:6379",
});

redisClient.on("error", (err: Error) => console.error("[Redis] Error:", err));

export async function connectRedis(): Promise<void> {
  if (redisClient.isOpen) return;
  await redisClient.connect();
  console.log("[Redis] Connected");
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient.isOpen) return;
  await redisClient.quit();
  console.log("[Redis] Disconnected gracefully");
}

export function redisHealthCheck(): { status: string; connected: boolean } {
  return {
    status: redisClient.isOpen ? "ok" : "degraded",
    connected: redisClient.isOpen,
  };
}
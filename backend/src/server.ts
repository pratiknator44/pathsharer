import http from "http";
import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./database/connection";
import { connectRedis, disconnectRedis } from "./database/redis";
import { initSocketIO } from "./sockets";

async function main(): Promise<void> {
  // Fail fast on bad env — connectDB will throw if MONGO_URI is missing
  await connectDB();

  // Redis is a soft dependency — warn but don't crash if unavailable
  try {
    await connectRedis();
  } catch (err) {
    console.warn("[Redis] Could not connect — continuing without cache:", (err as Error).message);
  }

  const httpServer = http.createServer(app);
  initSocketIO(httpServer);

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(
      `[Server] PathSharer backend running on port ${env.PORT} (${env.NODE_ENV})`
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down…`);
    httpServer.close(async () => {
      const { disconnectDB } = await import("./database/connection");
      await disconnectDB();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});

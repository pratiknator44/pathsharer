import http from "http";
import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./database/connection";
import { initSocketIO } from "./sockets";

async function main(): Promise<void> {
  // Fail fast on bad env — connectDB will throw if MONGO_URI is missing
  await connectDB();

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

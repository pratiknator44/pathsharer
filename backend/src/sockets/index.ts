import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { registerJourneySocketHandlers } from "./journey.socket";

let _io: Server | null = null;

export function initSocketIO(httpServer: HttpServer): Server {
  _io = new Server(httpServer, {
    cors: {
      origin: env.NODE_ENV === "production" ? false : "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  _io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    registerJourneySocketHandlers(_io!, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} — ${reason}`);
    });
  });

  console.log("[Socket] Socket.IO initialized");
  return _io;
}

/**
 * Get the initialized Socket.IO server instance.
 * Call this from services/controllers to emit events.
 */
export function getIO(): Server {
  if (!_io) throw new Error("Socket.IO not initialized");
  return _io;
}

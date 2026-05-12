import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env";
import { registerChatSocketHandlers } from "./chat.socket";
import { registerJourneySocketHandlers } from "./journey.socket";
import { registerNotificationSocketHandlers } from "./notification.socket";
import { registerRideSocketHandlers } from "./ride.socket";

// Keep in sync with auth.middleware.ts
const PRIVATE_JWT_KEY = "kamehameha!@#";

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

  // ── Socket authentication middleware ─────────────────────────────────────
  _io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Authentication error: missing token"));
    try {
      const payload = jwt.verify(token, PRIVATE_JWT_KEY) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Authentication error: invalid token"));
    }
  });

  _io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (user: ${socket.data.userId})`);

    registerJourneySocketHandlers(_io!, socket);
    registerChatSocketHandlers(_io!, socket);
    registerNotificationSocketHandlers(_io!, socket);
    registerRideSocketHandlers(_io!, socket);

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

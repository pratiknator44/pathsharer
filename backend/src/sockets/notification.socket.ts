import { Server, Socket } from "socket.io";
import { Notification } from "../models/notification.model";
import { SOCKET_EVENTS } from "./events";

export function registerNotificationSocketHandlers(
  _io: Server,
  socket: Socket
): void {
  const userId = socket.data.userId as string | undefined;
  if (!userId) return;

  // The socket is already in `user:<userId>` room from chat handler.
  // If chat handler is not registered for this socket, join here too.
  socket.join(`user:${userId}`);

  // ── Fetch unread count on connect ─────────────────────────────────────────
  socket.on("notification:get_unread_count", async () => {
    const count = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });
    socket.emit("notification:unread_count", { count });
  });
}

/**
 * Deliver a notification via Socket.IO to a connected user.
 * Called from services/controllers when a notable event occurs.
 */
export async function deliverNotification(
  io: Server,
  recipientId: string,
  params: {
    type: "message" | "journey" | "match" | "ring" | "system";
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const notification = await Notification.create({
    recipient: recipientId,
    ...params,
  });

  const event =
    params.type === "ring"
      ? SOCKET_EVENTS.NOTIFICATION_RING
      : SOCKET_EVENTS.NOTIFICATION_NEW;

  io.to(`user:${recipientId}`).emit(event, notification.toObject());
}

import { Types } from "mongoose";
import { Server, Socket } from "socket.io";
import { Message } from "../models/message.model";
import {
  ChatReadPayload,
  ChatSendMessagePayload,
  ChatTypingPayload,
  SOCKET_EVENTS,
} from "./events";

/**
 * In-memory map of userId -> set of active socketIds.
 * Allows a user to be connected from multiple tabs/devices.
 */
const onlineUsers = new Map<string, Set<string>>();

/** Returns true if the user has at least one active socket connection. */
export function isUserOnline(userId: string): boolean {
  const sockets = onlineUsers.get(userId);
  return !!sockets && sockets.size > 0;
}

export function registerChatSocketHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string | undefined;
  if (!userId) return;

  // ── Join personal room and mark online ──────────────────────────────────
  socket.join(`user:${userId}`);

  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);

  // Broadcast online status change
  io.emit(SOCKET_EVENTS.CHAT_ONLINE_STATUS, { userId, online: true });

  // ── Send message ─────────────────────────────────────────────────────────
  socket.on(
    SOCKET_EVENTS.CHAT_SEND_MESSAGE,
    async (payload: ChatSendMessagePayload) => {
      const { toUserId, type, content, imageUrl } = payload;

      if (!Types.ObjectId.isValid(toUserId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid toUserId" });
        return;
      }

      if (type === "text" && !content?.trim()) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "content is required for text messages" });
        return;
      }

      if (type === "image" && !imageUrl?.trim()) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "imageUrl is required for image messages" });
        return;
      }

      const message = await Message.create({
        sender: new Types.ObjectId(userId),
        receiver: new Types.ObjectId(toUserId),
        type,
        content: type === "text" ? content : undefined,
        imageUrl: type === "image" ? imageUrl : undefined,
      });

      const populated = await message.populate([
        { path: "sender", select: "name" },
        { path: "receiver", select: "name" },
      ]);

      // Deliver to recipient's personal room (all their devices)
      io.to(`user:${toUserId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, populated);

      // Echo back to sender (for multi-device sync)
      socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, populated);
    }
  );

  // ── Typing indicator ──────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CHAT_TYPING, (payload: ChatTypingPayload) => {
    const { toUserId, isTyping } = payload;

    if (!Types.ObjectId.isValid(toUserId)) return;

    io.to(`user:${toUserId}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
      fromUserId: userId,
      isTyping,
    });
  });

  // ── Read receipts ─────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CHAT_READ, async (payload: ChatReadPayload) => {
    const { fromUserId } = payload;

    if (!Types.ObjectId.isValid(fromUserId)) return;

    const now = new Date();
    await Message.updateMany(
      {
        sender: new Types.ObjectId(fromUserId),
        receiver: new Types.ObjectId(userId),
        read: false,
      },
      { read: true, readAt: now }
    );

    // Notify original sender that their messages were read
    io.to(`user:${fromUserId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE_READ, {
      byUserId: userId,
      readAt: now,
    });
  });

  // ── Disconnect: remove from online tracking ───────────────────────────────
  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit(SOCKET_EVENTS.CHAT_ONLINE_STATUS, { userId, online: false });
      }
    }
  });
}

import { Types } from "mongoose";
import { Server, Socket } from "socket.io";
import { User } from "../models/user.model";
import {
  RideConnectRequestPayload,
  RideConnectResponsePayload,
  SOCKET_EVENTS,
} from "./events";

export function registerRideSocketHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string | undefined;
  if (!userId) return;

  // ── Initiate a ride connection request ────────────────────────────────────
  socket.on(
    SOCKET_EVENTS.RIDE_CONNECT_REQUEST,
    async (payload: RideConnectRequestPayload) => {
      try {
        const { toUserId, toDestination, requestId } = payload;

        console.log(`[Ride] RIDE_CONNECT_REQUEST from ${userId} → ${toUserId} (reqId: ${requestId})`);

        if (!Types.ObjectId.isValid(toUserId)) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid toUserId" });
          return;
        }

        if (!requestId) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: "requestId is required" });
          return;
        }

        // Look up requester's name to display in the overlay
        const requester = await User.findById(userId).select("name").lean();
        const fromName = (requester as any)?.name ?? `Passenger ${userId.slice(0, 6)}`;

        // Check how many sockets are in the target room
        const roomSockets = await io.in(`user:${toUserId}`).fetchSockets();
        console.log(`[Ride] Room user:${toUserId} has ${roomSockets.length} socket(s)`);

        // Deliver to the target user's personal room
        io.to(`user:${toUserId}`).emit(SOCKET_EVENTS.RIDE_CONNECT_REQUEST_INCOMING, {
          fromUserId: userId,
          fromName,
          toDestination,
          requestId,
        });

        console.log(`[Ride] Emitted RIDE_CONNECT_REQUEST_INCOMING to user:${toUserId}`);
      } catch (err) {
        console.error("[Ride] Error handling RIDE_CONNECT_REQUEST:", err);
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Internal error processing ride request" });
      }
    }
  );

  // ── Respond to an incoming ride connection request ─────────────────────────
  socket.on(
    SOCKET_EVENTS.RIDE_CONNECT_RESPONSE,
    (payload: RideConnectResponsePayload) => {
      const { toUserId, decision, requestId } = payload;

      if (!Types.ObjectId.isValid(toUserId)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid toUserId" });
        return;
      }

      // Relay the decision back to the original requester
      io.to(`user:${toUserId}`).emit(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE_RESULT, {
        fromUserId: userId,
        decision,
        requestId,
      });
    }
  );
}

import { Types } from "mongoose";
import { Server, Socket } from "socket.io";
import { Journey } from "../models/journey.model";
import { SOCKET_EVENTS } from "./events";

export function registerJourneySocketHandlers(io: Server, socket: Socket): void {
  // Client joins a journey room to receive real-time updates
  socket.on(SOCKET_EVENTS.JOIN_JOURNEY_ROOM, async (journeyId: string) => {
    if (!Types.ObjectId.isValid(journeyId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid journeyId" });
      return;
    }

    const journey = await Journey.findById(journeyId).lean();
    if (!journey) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Journey not found" });
      return;
    }

    await socket.join(`journey:${journeyId}`);
    socket.emit(SOCKET_EVENTS.JOURNEY_UPDATED, { journey });
  });

  socket.on(SOCKET_EVENTS.LEAVE_JOURNEY_ROOM, async (journeyId: string) => {
    await socket.leave(`journey:${journeyId}`);
  });
}

/**
 * Emit a journey update to all sockets in the journey room.
 */
export function emitJourneyUpdate(
  io: Server,
  journeyId: string,
  event: string,
  payload: unknown
): void {
  io.to(`journey:${journeyId}`).emit(event, payload);
}

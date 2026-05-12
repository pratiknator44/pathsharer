export const SOCKET_EVENTS = {
  // ── Journey ─────────────────────────────────────────────────────────────
  // Client -> Server
  JOIN_JOURNEY_ROOM: "journey:join_room",
  LEAVE_JOURNEY_ROOM: "journey:leave_room",

  // Server -> Client
  JOURNEY_CREATED: "journey:created",
  JOURNEY_UPDATED: "journey:updated",
  JOURNEY_PARTICIPANT_JOINED: "journey:participant_joined",
  JOURNEY_PARTICIPANT_LEFT: "journey:participant_left",
  JOURNEY_BOOKED: "journey:booked",
  JOURNEY_STATUS_CHANGED: "journey:status_changed",
  JOURNEY_CANCELLED: "journey:cancelled",
  JOURNEY_COMPLETED: "journey:completed",

  FARE_UPDATED: "fare:updated",
  USER_JOURNEY_UPDATED: "userjourney:updated",

  // ── Chat (1-1 Messaging) ─────────────────────────────────────────────────
  // Client -> Server
  CHAT_SEND_MESSAGE: "chat:send_message",
  CHAT_TYPING: "chat:typing",
  CHAT_READ: "chat:read",

  // Server -> Client
  CHAT_MESSAGE: "chat:message",
  CHAT_MESSAGE_READ: "chat:message_read",
  CHAT_ONLINE_STATUS: "chat:online_status",

  // ── Ride Connection ───────────────────────────────────────────────────────
  // Client -> Server
  RIDE_CONNECT_REQUEST: "ride:connect_request",
  RIDE_CONNECT_RESPONSE: "ride:connect_response",

  // Server -> Client
  RIDE_CONNECT_REQUEST_INCOMING: "ride:connect_request_incoming",
  RIDE_CONNECT_RESPONSE_RESULT: "ride:connect_response_result",

  // ── Notifications ────────────────────────────────────────────────────────
  // Server -> Client
  NOTIFICATION_NEW: "notification:new",
  NOTIFICATION_RING: "notification:ring",

  ERROR: "error",
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// ── Chat payload types ───────────────────────────────────────────────────────

export interface ChatSendMessagePayload {
  toUserId: string;
  type: "text" | "image";
  content?: string;
  imageUrl?: string;
}

export interface ChatTypingPayload {
  toUserId: string;
  isTyping: boolean;
}

export interface ChatReadPayload {
  fromUserId: string; // whose messages to mark as read
}

// ── Ride connection payload types ────────────────────────────────────────────

export interface RideConnectRequestPayload {
  toUserId: string;
  /** The requesting user's destination label shown to the target */
  toDestination: string;
  requestId: string;
}

export interface RideConnectResponsePayload {
  /** Original requester's userId */
  toUserId: string;
  decision: "accepted" | "denied" | "ignored";
  requestId: string;
}


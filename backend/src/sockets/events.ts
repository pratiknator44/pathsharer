export const SOCKET_EVENTS = {
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

  ERROR: "error",
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

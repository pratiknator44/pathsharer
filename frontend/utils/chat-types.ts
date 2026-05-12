/** Socket.IO event name constants — keep in sync with backend/src/sockets/events.ts */
export const SOCKET_EVENTS = {
  // Chat
  CHAT_SEND_MESSAGE: 'chat:send_message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  CHAT_MESSAGE: 'chat:message',
  CHAT_MESSAGE_READ: 'chat:message_read',
  CHAT_ONLINE_STATUS: 'chat:online_status',

  // Ride connection
  RIDE_CONNECT_REQUEST: 'ride:connect_request',
  RIDE_CONNECT_RESPONSE: 'ride:connect_response',
  RIDE_CONNECT_REQUEST_INCOMING: 'ride:connect_request_incoming',
  RIDE_CONNECT_RESPONSE_RESULT: 'ride:connect_response_result',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_RING: 'notification:ring',

  ERROR: 'error',
} as const;

// ── Shared type shapes ───────────────────────────────────────────────────────

export interface ChatMessage {
  _id: string;
  sender: { _id: string; name: string };
  receiver: { _id: string; name: string };
  type: 'text' | 'image';
  content?: string;
  imageUrl?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  userId: string;
  name: string;
  unreadCount: number;
  lastMessage: {
    type: 'text' | 'image';
    content?: string;
    imageUrl?: string;
    createdAt: string;
    isMine: boolean;
  };
}

// ── Ride connection types ────────────────────────────────────────────────────

export interface IncomingRideRequest {
  fromUserId: string;
  fromName: string;
  toDestination: string;
  requestId: string;
}

export type RideConnectDecision = 'accepted' | 'denied' | 'ignored';

export interface RideResponseResult {
  fromUserId: string;
  decision: RideConnectDecision;
  requestId: string;
}

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, tokenStore } from './api';
import { useAuth } from './AuthContext';
import { playMessagePing } from './notificationService';

const BASE_URL = getApiBaseUrl().replace(/\/api\/v1\/?$/, '');

export const SOCKET_EVENTS = {
  CHAT_MESSAGE: 'chat:message',
  CHAT_SEND_MESSAGE: 'chat:send_message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  RIDE_CONNECT_REQUEST: 'ride:connect_request',
  RIDE_CONNECT_RESPONSE_RESULT: 'ride:connect_response_result',
  RIDE_CONNECT_INCOMING: 'ride:connect_request_incoming',
  RIDE_CONNECT_RESPONSE: 'ride:connect_response',
};

export interface ChatMessage {
  _id: string;
  sender: { _id: string; name?: string };
  receiver: { _id: string; name?: string };
  content?: string;
  type: 'text' | 'image';
  imageUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface Conversation {
  userId: string;
  name: string;
  lastMessage: {
    content?: string;
    type: 'text' | 'image';
    isMine: boolean;
    createdAt: string;
  };
  unreadCount: number;
}

export interface RideConnectRequestPayload {
  toUserId: string;
  toDestination: string;
  requestId: string;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  unreadCount: number;
  connectionError: string | null;
  sendRideConnectRequest: (payload: RideConnectRequestPayload) => boolean;
  clearUnread: () => void;
}

const SocketContext = createContext<SocketState>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  unreadCount: 0,
  connectionError: null,
  sendRideConnectRequest: () => false,
  clearUnread: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const token = tokenStore.get();
    if (!token) return;

    const s = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    setSocket(s);
    s.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });
    s.on('disconnect', () => setIsConnected(false));
    s.on('connect_error', (err) => {
      setIsConnected(false);
      setConnectionError(err.message || 'Socket connection failed');
    });
    s.on('users:online', (users: string[]) => setOnlineUsers(new Set(users)));
    s.on('user:online', (userId: string) => setOnlineUsers((p) => new Set([...p, userId])));
    s.on('user:offline', (userId: string) => {
      setOnlineUsers((p) => { const n = new Set(p); n.delete(userId); return n; });
    });
    s.on(SOCKET_EVENTS.CHAT_MESSAGE, (message: ChatMessage) => {
      const isMine = message.sender?._id === user._id;
      if (!isMine) {
        playMessagePing();
        setUnreadCount((n) => n + 1);
      }
    });

    return () => { s.disconnect(); setSocket(null); setIsConnected(false); };
  }, [user]);

  function sendRideConnectRequest(payload: RideConnectRequestPayload): boolean {
    if (!socket?.connected) return false;
    socket.emit(SOCKET_EVENTS.RIDE_CONNECT_REQUEST, payload);
    return true;
  }

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        unreadCount,
        connectionError,
        sendRideConnectRequest,
        clearUnread: () => setUnreadCount(0),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketState {
  return useContext(SocketContext);
}

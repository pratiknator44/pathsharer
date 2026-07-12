import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/auth-context';
import { ChatMessage, IncomingRideRequest, RideResponseResult, SOCKET_EVENTS } from '@/utils/chat-types';
import { SOCKET_URL } from '@/utils/socket-url';
import { getAuthToken } from '@/utils/storage';
import { sendRideRequestNotification } from '@/utils/notifications';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  /** Pending incoming ride-connect request shown as overlay */
  pendingRideRequest: IncomingRideRequest | null;
  clearPendingRideRequest: () => void;
  /** Manually reconnect (e.g. after token refresh) */
  reconnect: () => Promise<void>;
  /** True when a new chat message arrived since last clearing */
  hasUnreadMessages: boolean;
  clearUnreadMessages: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  pendingRideRequest: null,
  clearPendingRideRequest: () => { },
  reconnect: async () => { },
  hasUnreadMessages: false,
  clearUnreadMessages: () => { },
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [pendingRideRequest, setPendingRideRequest] = useState<IncomingRideRequest | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const connect = useCallback(async () => {
    // Clean up any existing connection first
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const token = await getAuthToken();
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      // Use default transports (polling → WebSocket upgrade) for maximum
      // compatibility with physical devices / Expo Go on varied networks.
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id);
      setIsConnected(true);
    });
    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });
    s.on('connect_error', (err) => {
      console.error("CONNECT ERROR");
      console.error("message:", err);
    });

    s.on(SOCKET_EVENTS.CHAT_ONLINE_STATUS, ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    s.on(SOCKET_EVENTS.CHAT_MESSAGE, (msg: ChatMessage) => {
      // Only flag unread for messages addressed to us (not sent by us)
      if (msg && msg.sender) {
        setHasUnreadMessages(true);
      }
    });

    s.on(SOCKET_EVENTS.RIDE_CONNECT_REQUEST_INCOMING, (payload: IncomingRideRequest) => {
      console.log('[Socket] RIDE_CONNECT_REQUEST_INCOMING received:', payload);
      setPendingRideRequest(payload);

      // App is backgrounded / screen locked — the in-app overlay won't be
      // visible, so fire a local notification to alert the user.
      if (AppState.currentState !== 'active') {
        sendRideRequestNotification(payload).catch((err) =>
          console.warn('[Socket] Could not send ride notification:', err),
        );
      }
    });

    socketRef.current = s;
    setIsConnected(s.connected);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setOnlineUsers(new Set());
      setPendingRideRequest(null);
      setHasUnreadMessages(false);
    }

    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, connect]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineUsers,
        pendingRideRequest,
        clearPendingRideRequest: () => setPendingRideRequest(null),
        reconnect: connect,
        hasUnreadMessages,
        clearUnreadMessages: () => setHasUnreadMessages(false),
      }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Helper: subscribe to incoming chat messages on the socket.
 * Returns an unsubscribe function.
 */
export function onChatMessage(socket: Socket, handler: (msg: ChatMessage) => void) {
  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handler);
  return () => socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handler);
}


import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, tokenStore } from '../api';
import { Conversation, SOCKET_EVENTS, useSocket } from '../SocketContext';

const API_URL = getApiBaseUrl();

const AVATAR_COLORS = [
  '#6C63FF', '#e07b39', '#7b5ea7', '#3a9e6a',
  '#c94f4f', '#4f7ec9', '#a06830', '#2e8b8b',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function InboxPage() {
  const navigate = useNavigate();
  const { socket, onlineUsers, clearUnread } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const token = tokenStore.get();
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setConversations(json.conversations ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    clearUnread();
  }, [fetchConversations, clearUnread]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchConversations();
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handler);
    return () => { socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handler); };
  }, [socket, fetchConversations]);

  return (
    <div className="inbox-root">
      <div className="inbox-header">
        <h1 className="inbox-title">Messages</h1>
        {socket?.connected && <span className="online-indicator" title="Connected" />}
      </div>

      {loading ? (
        <div className="centered-state">
          <div className="page-spinner" />
        </div>
      ) : error ? (
        <div className="centered-state">
          <p className="error-text">{error}</p>
          <button className="retry-pill" onClick={fetchConversations}>Retry</button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="centered-state">
          <div className="empty-icon">💬</div>
          <p className="empty-title">No conversations yet</p>
          <p className="empty-sub">Find co-passengers and start chatting!</p>
        </div>
      ) : (
        <div className="conv-list">
          {conversations.map((item) => {
            const isOnline = onlineUsers.has(item.userId);
            const preview =
              item.lastMessage.type === 'image'
                ? item.lastMessage.isMine ? '📷 You sent a photo' : '📷 Photo'
                : item.lastMessage.isMine
                ? `You: ${item.lastMessage.content ?? ''}`
                : item.lastMessage.content ?? '';

            return (
              <button
                key={item.userId}
                className="conv-row"
                onClick={() => navigate(`/chat/${item.userId}`, { state: { name: item.name } })}
              >
                <div className="avatar-wrap" style={{ background: avatarColor(item.userId) }}>
                  <span className="avatar-text">{initials(item.name)}</span>
                  {isOnline && <span className="online-dot" />}
                </div>
                <div className="conv-text">
                  <div className="conv-top">
                    <span className="conv-name">{item.name}</span>
                    <span className="conv-time">{formatRelativeTime(item.lastMessage.createdAt)}</span>
                  </div>
                  <div className="conv-bottom">
                    <span className={`conv-preview ${item.unreadCount > 0 ? 'preview-bold' : ''}`}>
                      {preview}
                    </span>
                    {item.unreadCount > 0 && (
                      <span className="unread-badge">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { tokenStore } from '../api';
import { ChatMessage, SOCKET_EVENTS, useSocket } from '../SocketContext';

const API_URL = process.env.REACT_APP_API_URL ?? 'http://localhost:5000/api/v1';
const INITIAL_LOAD = 100;
const LOAD_MORE_SIZE = 30;

// Phone regex for safety warning
const PHONE_REGEX = /((?:\+?\d[\d\s\-().]{6,}\d))/g;
const PHONE_REGEX_TEST = /^(?:\+?\d[\d\s\-().]{6,}\d)$/;

function MessageText({ content }: { content: string }) {
  const parts = content.split(PHONE_REGEX);
  return (
    <span className="bubble-text">
      {parts.map((part, i) =>
        PHONE_REGEX_TEST.test(part) ? (
          <a key={i} className="phone-link" href={`tel:${part.replace(/[^\d+]/g, '')}`}
            onClick={(e) => { e.preventDefault(); alert('Safety Reminder: Do not share personal info with strangers.\n\nTap OK to dial.'); window.location.href = `tel:${part.replace(/[^\d+]/g, '')}`; }}>
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}

export default function ChatPage() {
  const { userId: otherUserId } = useParams<{ userId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, onlineUsers } = useSocket();
  const name = (location.state as any)?.name ?? 'Chat';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOnline = onlineUsers.has(otherUserId ?? '');

  const fetchHistory = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const token = tokenStore.get();
      const res = await fetch(`${API_URL}/messages/${otherUserId}?limit=${INITIAL_LOAD}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setMessages(json.messages ?? []);
      setHasMore((json.messages?.length ?? 0) === INITIAL_LOAD);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket events
  useEffect(() => {
    if (!socket || !otherUserId) return;

    function handleMessage(msg: ChatMessage) {
      const msgOtherUser =
        msg.sender._id === otherUserId ? msg.sender._id : msg.receiver._id;
      if (msgOtherUser !== otherUserId && msg.sender._id !== otherUserId) return;
      setMessages((prev) => [...prev, msg]);
      socket!.emit(SOCKET_EVENTS.CHAT_READ, { fromUserId: otherUserId });
    }

    function handleTyping({ fromUserId, isTyping: t }: { fromUserId: string; isTyping: boolean }) {
      if (fromUserId === otherUserId) setIsTyping(t);
    }

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, handleTyping);
    socket.emit(SOCKET_EVENTS.CHAT_READ, { fromUserId: otherUserId });

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, handleTyping);
    };
  }, [socket, otherUserId]);

  const fetchOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0 || !otherUserId) return;
    setLoadingMore(true);
    const oldestCreatedAt = messages[0].createdAt;
    try {
      const token = tokenStore.get();
      const url = `${API_URL}/messages/${otherUserId}?before=${encodeURIComponent(oldestCreatedAt)}&limit=${LOAD_MORE_SIZE}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      if (json.messages?.length === 0) { setHasMore(false); return; }
      setMessages((prev) => [...json.messages, ...prev]);
      setHasMore(json.messages.length === LOAD_MORE_SIZE);
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, otherUserId]);

  function handleTextChange(val: string) {
    setText(val);
    if (!socket || !otherUserId) return;
    socket.emit(SOCKET_EVENTS.CHAT_TYPING, { toUserId: otherUserId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING, { toUserId: otherUserId, isTyping: false });
    }, 2000);
  }

  function sendText() {
    if (!text.trim() || !socket || !otherUserId) return;
    socket.emit(SOCKET_EVENTS.CHAT_SEND_MESSAGE, {
      toUserId: otherUserId,
      type: 'text',
      content: text.trim(),
    });
    setText('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket.emit(SOCKET_EVENTS.CHAT_TYPING, { toUserId: otherUserId, isTyping: false });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  }

  return (
    <div className="chat-root">
      {/* Header */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => navigate(-1)}>←</button>
        <div className="chat-header-meta">
          <span className="chat-header-name">{name}</span>
          <span className={`chat-header-status ${isOnline ? 'status-online' : 'status-offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {loadingMore && <div className="load-more-row"><span className="page-spinner small-spinner" /></div>}
        {hasMore && !loadingMore && (
          <button className="load-more-btn" onClick={fetchOlderMessages}>
            Load earlier messages
          </button>
        )}

        {loading ? (
          <div className="centered-state"><div className="page-spinner" /></div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender._id !== otherUserId;
            return (
              <div key={msg._id} className={`bubble-wrap ${isMine ? 'bubble-right' : 'bubble-left'}`}>
                <div className={`bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                  {msg.type === 'image' && msg.imageUrl ? (
                    <img src={msg.imageUrl} alt="sent" className="msg-image" />
                  ) : (
                    <MessageText content={msg.content ?? ''} />
                  )}
                  <span className="bubble-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (msg.read ? '  ✓✓' : '  ✓')}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {isTyping && (
          <div className="typing-row">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          placeholder="Message…"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          className={`chat-send-btn ${text.trim() ? 'send-active' : 'send-inactive'}`}
          onClick={sendText}
          disabled={!text.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}

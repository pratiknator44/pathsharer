import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useSocket } from '@/context/socket-context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatMessage, Conversation, SOCKET_EVENTS } from '@/utils/chat-types';
import { API_URL } from '@/utils/api';
import { getAuthToken } from '@/utils/storage';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const AVATAR_COLORS = [
  '#0a7ea4', '#e07b39', '#7b5ea7', '#3a9e6a',
  '#c94f4f', '#4f7ec9', '#a06830', '#2e8b8b',
];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ConversationRowProps {
  item: Conversation;
  isOnline: boolean;
  isDark: boolean;
  onPress: () => void;
}

function ConversationRow({ item, isOnline, isDark, onPress }: ConversationRowProps) {
  const colors = Colors[isDark ? 'dark' : 'light'];
  const bg = isDark ? '#1c1c1e' : '#fff';
  const subText = isDark ? '#8e8e93' : '#6b6b6b';
  const unreadBg = colors.tint;

  const preview =
    item.lastMessage.type === 'image'
      ? item.lastMessage.isMine
        ? '📷 You sent a photo'
        : '📷 Photo'
      : item.lastMessage.isMine
      ? `You: ${item.lastMessage.content ?? ''}`
      : (item.lastMessage.content ?? '');

  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.7}>
      {/* Avatar */}
      <View style={[styles.avatarWrap, { backgroundColor: avatarColor(item.userId) }]}>
        <Text style={styles.avatarText}>{initials(item.name)}</Text>
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.time, { color: subText }]}>
            {formatRelativeTime(item.lastMessage.createdAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.preview,
              { color: item.unreadCount > 0 ? colors.text : subText },
              item.unreadCount > 0 && styles.previewBold,
            ]}
            numberOfLines={1}>
            {preview}
          </Text>
          {item.unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: unreadBg }]}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function InboxScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { socket, isConnected, onlineUsers, clearUnreadMessages } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;

  // ── Clear unread dot when inbox is focused ────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      clearUnreadMessages();
    }, [clearUnreadMessages]),
  );

  // ── Fetch conversations from REST API ──────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = (await res.json()) as { conversations: Conversation[] };
      setConversations(json.conversations);
      setError(null);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Real-time: update list when a new message arrives ─────────────────────
  useEffect(() => {
    if (!socket) return;

    function handleNewMessage(msg: ChatMessage) {
      const otherUser =
        msg.sender._id === msg.receiver._id
          ? msg.receiver
          : msg.sender._id
          ? msg.sender
          : msg.receiver;

      // Determine which side is "the other person" relative to the receiver field
      // We don't have the current userId here, so we refresh from API to stay accurate
      fetchConversations();
    }

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleNewMessage);
    return () => { socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleNewMessage); };
  }, [socket, fetchConversations]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const bg = isDark ? '#000' : '#f2f2f7';

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#2c2c2e' : '#e0e0e0' }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        {isConnected && <View style={[styles.connectedDot, { backgroundColor: '#34c759' }]} />}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.icon }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: colors.tint }]}
            onPress={fetchConversations}>
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList<Conversation>
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              isOnline={onlineUsers.has(item.userId)}
              isDark={isDark}
              onPress={() =>
                router.push({
                  pathname: '/chat/[userId]',
                  params: { userId: item.userId, name: item.name },
                })
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View
              style={[
                styles.separator,
                { backgroundColor: isDark ? '#2c2c2e' : '#e5e5ea', marginLeft: 76 },
              ]}
            />
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: colors.icon }]}>No conversations yet</Text>
              <Text style={[styles.emptySubText, { color: colors.icon }]}>
                Start chatting with your co-passengers!
              </Text>
            </View>
          }
          contentContainerStyle={conversations.length === 0 && styles.emptyList}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', flex: 1 },
  connectedDot: { width: 8, height: 8, borderRadius: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#34c759',
    borderWidth: 2,
    borderColor: '#fff',
  },

  textBlock: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  name: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12 },

  rowBottom: { flexDirection: 'row', alignItems: 'center' },
  preview: { fontSize: 14, flex: 1, marginRight: 6 },
  previewBold: { fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  separator: { height: StyleSheet.hairlineWidth },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyList: { flexGrow: 1 },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptySubText: { fontSize: 14, textAlign: 'center' },
  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
});

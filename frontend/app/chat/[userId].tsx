import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useSocket } from '@/context/socket-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { ChatMessage, SOCKET_EVENTS } from '@/utils/chat-types';
import { getAuthToken } from '@/utils/storage';

const INITIAL_LOAD = 100;
const LOAD_MORE_SIZE = 30;
const MAX_MESSAGES = 120;
const TRIM_COUNT = 20;

// Matches common phone number formats (+91 98765 43210, (123) 456-7890, etc.)
const PHONE_REGEX = /((?:\+?\d[\d\s\-().]{6,}\d))/g;
const PHONE_REGEX_TEST = /^(?:\+?\d[\d\s\-().]{6,}\d)$/;

function handlePhonePress(phone: string) {
  Alert.alert(
    'Safety Reminder',
    'Please do not share any personal information with strangers.',
    [
      {
        text: 'OK',
        onPress: () => {
          const digits = phone.replace(/[^\d+]/g, '');
          Linking.openURL(`tel:${digits}`);
        },
      },
    ],
  );
}

function MessageText({ content, color }: { content: string; color: string }) {
  const parts = content.split(PHONE_REGEX);
  return (
    <Text style={[styles.bubbleText, { color }]}>
      {parts.map((part, i) =>
        PHONE_REGEX_TEST.test(part) ? (
          <Text
            key={i}
            style={styles.phoneLink}
            onPress={() => handlePhonePress(part)}>
            {part}
          </Text>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </Text>
  );
}

export default function ChatScreen() {
  const { userId: otherUserId, name } = useLocalSearchParams<{ userId: string; name: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { socket, onlineUsers } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // How many messages were prepended last time (used to restore scroll pos)
  const prependCountRef = useRef(0);

  const isOnline = onlineUsers.has(otherUserId ?? '');

  // ── Fetch history ──────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}/messages/${otherUserId}?limit=${INITIAL_LOAD}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = (await res.json()) as { messages: ChatMessage[]; pageSize: number };
      setMessages(json.messages);
      setHasMore(json.messages.length === INITIAL_LOAD);
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message ?? 'Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Delete a server-side image (fire-and-forget) ──────────────────────────
  async function deleteImageFile(imageUrl: string) {
    const filename = imageUrl.split('/uploads/').pop();
    if (!filename) return;
    const token = await getAuthToken();
    fetch(`${API_URL}/messages/image`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ filename }),
    }).catch(() => {});
  }

  // ── Load older messages (scroll-up pagination) ────────────────────────────
  const fetchOlderMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestCreatedAt = messages[0].createdAt;
    try {
      const token = await getAuthToken();
      const url =
        `${API_URL}/messages/${otherUserId}` +
        `?before=${encodeURIComponent(oldestCreatedAt)}&limit=${LOAD_MORE_SIZE}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = (await res.json()) as { messages: ChatMessage[] };
      if (json.messages.length === 0) {
        setHasMore(false);
        return;
      }
      prependCountRef.current = json.messages.length;
      setMessages((prev) => [...json.messages, ...prev]);
      setHasMore(json.messages.length === LOAD_MORE_SIZE);
    } catch {
      // silent — user can try again by scrolling
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, otherUserId]);

  // ── Restore scroll position after prepending older messages ──────────────
  useEffect(() => {
    const count = prependCountRef.current;
    if (count > 0 && messages.length > count) {
      prependCountRef.current = 0;
      // Jump to the first message that was previously at the top
      listRef.current?.scrollToIndex({ index: count, animated: false });
    }
  }, [messages]);

  // ── Socket: receive messages & typing ─────────────────────────────────────
  useEffect(() => {
    if (!socket || !otherUserId) return;

    function handleMessage(msg: ChatMessage) {
      const msgOtherUser =
        msg.sender._id === otherUserId ? msg.sender._id : msg.receiver._id;
      if (msgOtherUser !== otherUserId && msg.sender._id !== otherUserId) return;

      setMessages((prev) => {
        const next = [...prev, msg];
        // Cap queue: trim 20 oldest if over MAX_MESSAGES
        if (next.length > MAX_MESSAGES) {
          const removed = next.splice(0, TRIM_COUNT);
          removed
            .filter((m) => m.type === 'image' && m.imageUrl)
            .forEach((m) => deleteImageFile(m.imageUrl!));
          return next;
        }
        return next;
      });
      listRef.current?.scrollToEnd({ animated: true });

      // Mark as read
      socket!.emit(SOCKET_EVENTS.CHAT_READ, { fromUserId: otherUserId });
    }

    function handleTyping({ fromUserId, isTyping: t }: { fromUserId: string; isTyping: boolean }) {
      if (fromUserId === otherUserId) setIsTyping(t);
    }

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, handleTyping);

    // Mark existing unread messages as read when opening chat
    socket.emit(SOCKET_EVENTS.CHAT_READ, { fromUserId: otherUserId });

    return () => {
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, handleMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, handleTyping);
    };
  }, [socket, otherUserId]);

  // ── Typing indicator ───────────────────────────────────────────────────────
  function handleTextChange(val: string) {
    setText(val);
    if (!socket || !otherUserId) return;

    socket.emit(SOCKET_EVENTS.CHAT_TYPING, { toUserId: otherUserId, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit(SOCKET_EVENTS.CHAT_TYPING, { toUserId: otherUserId, isTyping: false });
    }, 2000);
  }

  // ── Send text ──────────────────────────────────────────────────────────────
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

  // ── Upload & send image ────────────────────────────────────────────────────
  async function pickAndSendImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to send images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadingImage(true);

    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as unknown as Blob);

      const uploadRes = await fetch(`${API_URL}/messages/upload-image`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed ${uploadRes.status}`);
      const { imageUrl } = (await uploadRes.json()) as { imageUrl: string };

      socket?.emit(SOCKET_EVENTS.CHAT_SEND_MESSAGE, {
        toUserId: otherUserId,
        type: 'image',
        imageUrl,
      });
    } catch (err: unknown) {
      Alert.alert('Upload failed', (err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  }

  // ── Render message bubble ──────────────────────────────────────────────────
  function renderMessage({ item }: { item: ChatMessage }) {
    // We consider a message "mine" when the sender._id is not the other user
    const isMine = item.sender._id !== otherUserId;
    const bubbleBg = isMine
      ? isDark ? '#2c2c2e' : '#fff'
      : isDark
      ? '#1a3d2b'
      : '#CBF6DB';
    const bubbleText = isMine ? (isDark ? '#fff' : '#1c1c1e') : isDark ? '#e5ffe5' : '#1a3d2b';

    return (
      <View style={[styles.bubbleWrap, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          {item.type === 'image' && item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.msgImage}
              resizeMode="cover"
            />
          ) : (
            <MessageText content={item.content ?? ''} color={bubbleText} />
          )}
          <Text style={[styles.bubbleTime, { color: isMine ? colors.icon : (isDark ? '#6dbf8a' : '#4a8c62') }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isMine && (item.read ? '  ✓✓' : '  ✓')}
          </Text>
        </View>
      </View>
    );
  }

  const bg = isDark ? '#000' : '#f2f2f7';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? '#1c1c1e' : '#fff',
            borderBottomColor: isDark ? '#2c2c2e' : '#e0e0e0',
          },
        ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.tint} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
            {name ?? 'Chat'}
          </Text>
          <Text style={[styles.headerStatus, { color: isOnline ? '#34c759' : colors.icon }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList<ChatMessage>
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          onScroll={(e) => {
            if (e.nativeEvent.contentOffset.y < 80 && hasMore && !loadingMore) {
              fetchOlderMessages();
            }
          }}
          scrollEventThrottle={200}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            loadingMore ? (
              <View style={styles.loadMoreRow}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMoreRow} onPress={fetchOlderMessages}>
                <Text style={[styles.loadMoreText, { color: colors.tint }]}>Load earlier messages</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingRow}>
          <Text style={[styles.typingText, { color: colors.icon }]}>{name} is typing…</Text>
        </View>
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: isDark ? '#1c1c1e' : '#fff',
            borderTopColor: isDark ? '#2c2c2e' : '#e0e0e0',
            paddingBottom: insets.bottom + 4,
          },
        ]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={pickAndSendImage}
          disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : (
            <Ionicons name="image-outline" size={24} color={colors.tint} />
          )}
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? '#2c2c2e' : '#f2f2f7',
              color: colors.text,
            },
          ]}
          placeholder="Message"
          placeholderTextColor={colors.icon}
          value={text}
          onChangeText={handleTextChange}
          multiline
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.tint, opacity: text.trim() ? 1 : 0.4 }]}
          onPress={sendText}
          disabled={!text.trim()}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  headerMeta: { flex: 1, marginLeft: 4 },
  headerName: { fontSize: 17, fontWeight: '600' },
  headerStatus: { fontSize: 12, marginTop: 1 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  messageList: { padding: 12, paddingBottom: 4 },
  bubbleWrap: { marginVertical: 3, maxWidth: '75%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  phoneLink: { color: '#007aff', textDecorationLine: 'underline' },
  msgImage: { width: 200, height: 150, borderRadius: 10 },

  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  loadMoreRow: { alignItems: 'center', paddingVertical: 10 },
  loadMoreText: { fontSize: 13, fontWeight: '500' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { padding: 8, marginBottom: 2 },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    maxHeight: 100,
    marginHorizontal: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useSocket } from '@/context/socket-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { getAuthToken } from '@/utils/storage';
import { RideConnectDecision, RideResponseResult, SOCKET_EVENTS } from '@/utils/chat-types';

interface UserData {
  userId: string;
  name?: string;
  isActive: boolean;
  source: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  updatedAt: string;
}

type ConnectStatus = 'idle' | 'connecting' | RideConnectDecision;

function getRelativeTime(dateString: string) {
  if (!dateString) return '';
  const diffInSeconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just Now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}mins ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

function statusLabel(status: ConnectStatus): string {
  switch (status) {
    case 'idle': return 'Connect';
    case 'connecting': return 'Connecting...';
    case 'accepted': return '✓ Accepted';
    case 'denied': return '✗ Denied';
    case 'ignored': return 'No response';
  }
}

function statusColor(status: ConnectStatus, tint: string): string {
  switch (status) {
    case 'idle': return tint;
    case 'connecting': return '#888';
    case 'accepted': return '#34c759';
    case 'denied': return '#ff3b30';
    case 'ignored': return '#aaa';
  }
}

export default function PotentialCopassengersScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { socket } = useSocket();
  const [cancelling, setCancelling] = useState(false);

  const { users, sourceName, destName } = useLocalSearchParams<{
    users: string;
    sourceName: string;
    destName: string;
  }>();

  let parsedUsers: UserData[] = [];
  try {
    if (users) parsedUsers = JSON.parse(users);
  } catch (err) {
    console.error('Failed to parse users', err);
  }

  // Track per-card state: requestId → userId, userId → status
  // acceptedUsers maps userId → their name (for chat navigation)
  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const requestMap = useRef<Record<string, string>>({}); // requestId → userId
  const userNameMap = useRef<Record<string, string>>({}); // userId → name // requestId → userId

  // ── Listen for response results from the target users ─────────────────────
  useEffect(() => {
    if (!socket) return;

    function handleResponseResult(result: RideResponseResult) {
      const targetUserId = requestMap.current[result.requestId];
      if (!targetUserId) return;
      setConnectStatus((prev) => ({ ...prev, [targetUserId]: result.decision }));
    }

    socket.on(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE_RESULT, handleResponseResult);
    return () => { socket.off(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE_RESULT, handleResponseResult); };
  }, [socket]);

  const handleConnect = useCallback(
    (item: UserData) => {
      if (!socket || !socket.connected) {
        console.warn('[PotentialCopassengers] Socket not connected, cannot send ride request');
        return;
      }
      const status = connectStatus[item.userId] ?? 'idle';
      if (status !== 'idle') return;

      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      requestMap.current[requestId] = item.userId;
      // Store source user name for chat header (use passenger ID as fallback)
      userNameMap.current[item.userId] = `Passenger ${item.userId.substring(0, 8)}`;

      setConnectStatus((prev) => ({ ...prev, [item.userId]: 'connecting' }));

      console.log('[PotentialCopassengers] Emitting RIDE_CONNECT_REQUEST to', item.userId);
      socket.emit(SOCKET_EVENTS.RIDE_CONNECT_REQUEST, {
        toUserId: item.userId,
        toDestination: destName ?? 'unknown destination',
        requestId,
      });
    },
    [socket, connectStatus, destName]
  );

  const handleCancel = useCallback(async () => {
    Alert.alert(
      'Cancel Search',
      'This will remove you from co-passenger search. Continue?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const token = await getAuthToken();
              await fetch(`${API_URL}/active-users/me`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
            } catch (err) {
              console.warn('[PotentialCopassengers] Failed to delete active user:', err);
            } finally {
              setCancelling(false);
              router.back();
            }
          },
        },
      ]
    );
  }, [router]);

  const handleMessage = useCallback(
    (userId: string) => {
      const name = userNameMap.current[userId] ?? 'Passenger';
      router.push({ pathname: '/chat/[userId]', params: { userId, name } });
    },
    [router]
  );

  const bg = colors.background;
  const textColor = colors.text;
  const iconColor = colors.icon;
  const cardBg = colorScheme === 'dark' ? '#1e1e1e' : '#ffffff';
  const border = colorScheme === 'dark' ? '#333' : '#eee';

  const renderItem = ({ item }: { item: UserData }) => {
    const status: ConnectStatus = connectStatus[item.userId] ?? 'idle';
    const isDisabled = status !== 'idle';
    const btnColor = statusColor(status, colors.tint);
    const isAccepted = status === 'accepted';

    return (
      <View style={[styles.userCard, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.userTitleRow}>
          <Text style={[styles.userTitle, { color: textColor }]}>
            Passenger ID:123 {item.name?.substring(0, 8)}...
          </Text>
          <Text style={styles.timeText}>{getRelativeTime(item.updatedAt)}</Text>
        </View>

        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.locationText, { color: iconColor }]} numberOfLines={1}>
            From: {item.source?.name}
          </Text>
        </View>

        <View style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
          <Text style={[styles.locationText, { color: iconColor }]} numberOfLines={1}>
            To: {item.destination?.name}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.connectButton,
              { backgroundColor: btnColor, opacity: isDisabled ? 0.85 : 1, flex: isAccepted ? 1 : undefined },
            ]}
            activeOpacity={0.8}
            disabled={isDisabled}
            onPress={() => handleConnect(item)}>
            <Text style={styles.connectText}>{statusLabel(status)}</Text>
          </TouchableOpacity>

          {isAccepted && (
            <TouchableOpacity
              style={[styles.messageButton, { backgroundColor: colors.tint }]}
              activeOpacity={0.8}
              onPress={() => handleMessage(item.userId)}>
              <Text style={styles.messageIcon}>💬</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.tint }]}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: '#ff3b30', opacity: cancelling ? 0.6 : 1 }]}
            onPress={handleCancel}
            disabled={cancelling}>
            {cancelling
              ? <ActivityIndicator size="small" color="#ff3b30" />
              : <Text style={styles.cancelText}>✕ Cancel Search</Text>}
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: textColor }]}>Potential Co-passengers</Text>
      </View>

      <View style={styles.routeContainer}>
        <Text style={[styles.routeLabel, { color: textColor }]}>Your Route:</Text>
        <Text style={[styles.routeText, { color: iconColor }]}>
          <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>From: </Text>{sourceName}
        </Text>
        <Text style={[styles.routeText, { color: iconColor }]}>
          <Text style={{ color: '#F44336', fontWeight: 'bold' }}>To: </Text>{destName}
        </Text>
      </View>

      <FlatList
        data={parsedUsers}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: iconColor }]}>
              No potential co-passengers found.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {},
  cancelButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  cancelText: { color: '#ff3b30', fontSize: 13, fontWeight: '600' },
  backText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  routeContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  routeLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  routeText: { fontSize: 15, marginBottom: 4 },
  listContent: { padding: 16 },
  userCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userTitle: { fontSize: 16, fontWeight: '700' },
  timeText: { fontSize: 12, color: '#888' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  locationText: { fontSize: 14, flex: 1 },
  connectButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  connectText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  messageButton: {
    marginTop: 12,
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageIcon: { fontSize: 20 },
  emptyContainer: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 16, textAlign: 'center' },
});

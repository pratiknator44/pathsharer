import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useSocket } from '@/context/socket-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RideConnectDecision, SOCKET_EVENTS } from '@/utils/chat-types';

const RING_SOUND = require('../assets/music/ring.mp3');

type AcceptedState = { fromUserId: string; fromName: string } | null;

export default function RideRequestOverlay() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme];
  const { socket, pendingRideRequest, clearPendingRideRequest } = useSocket();
  const router = useRouter();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [responding, setResponding] = useState(false);
  const [acceptedState, setAcceptedState] = useState<AcceptedState>(null);
  const modalVisible = !!pendingRideRequest || !!acceptedState;

  useEffect(() => {
    if (!pendingRideRequest) return;
    let mounted = true;

    async function playRing() {
      // The audio session cannot acquire focus while the app is backgrounded.
      // Guard here so we never hit AudioFocusNotAcquiredException.
      if (AppState.currentState !== 'active') return;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound } = await Audio.Sound.createAsync(RING_SOUND, {
          isLooping: true,
          volume: 1,
        });
        if (!mounted) { await sound.unloadAsync(); return; }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (err) {
        console.warn('[RideOverlay] Could not play ring:', err);
      }
    }

    playRing();

    // If the app was backgrounded when the request arrived, start ringing
    // as soon as the user brings it back to the foreground.
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !soundRef.current && mounted) {
        playRing();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      soundRef.current?.stopAsync().then(() => soundRef.current?.unloadAsync());
      soundRef.current = null;
    };
  }, [pendingRideRequest]);

  const stopRing = useCallback(async () => {
    await soundRef.current?.stopAsync();
    await soundRef.current?.unloadAsync();
    soundRef.current = null;
  }, []);

  const respond = useCallback(
    async (decision: RideConnectDecision) => {
      if (!pendingRideRequest || !socket) return;
      setResponding(true);
      await stopRing();

      socket.emit(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE, {
        toUserId: pendingRideRequest.fromUserId,
        decision,
        requestId: pendingRideRequest.requestId,
      });

      if (decision === 'accepted') {
        setAcceptedState({ fromUserId: pendingRideRequest.fromUserId, fromName: pendingRideRequest.fromName });
      }

      clearPendingRideRequest();
      setResponding(false);
    },
    [pendingRideRequest, socket, clearPendingRideRequest, stopRing]
  );

  const closeAccepted = useCallback(() => setAcceptedState(null), []);

  const goToChat = useCallback(() => {
    if (!acceptedState) return;
    const { fromUserId, fromName } = acceptedState;
    setAcceptedState(null);
    router.push({ pathname: '/chat/[userId]', params: { userId: fromUserId, name: fromName } });
  }, [acceptedState, router]);

  if (!modalVisible) return null;

  const overlayBg = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)';
  const cardBg = isDark ? '#1c1c1e' : '#fff';
  const textColor = colors.text;
  const subColor = colors.icon;

  if (acceptedState) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={closeAccepted}>
        <View style={[styles.backdrop, { backgroundColor: overlayBg }]}>
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={[styles.iconRing, { borderColor: '#34c759' }]}>
              <Text style={styles.iconEmoji}>✅</Text>
            </View>
            <Text style={[styles.title, { color: '#34c759' }]}>Accepted!</Text>
            <Text style={[styles.requesterName, { color: textColor }]}>{acceptedState.fromName}</Text>
            <Text style={[styles.body, { color: subColor }]}>
              Your ride request has been accepted. Start chatting to coordinate.
            </Text>
            <TouchableOpacity
              style={[styles.messageFullBtn, { backgroundColor: colors.tint }]}
              activeOpacity={0.8}
              onPress={goToChat}>
              <Text style={styles.messageFullBtnText}>💬  Open Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeLinkBtn} onPress={closeAccepted}>
              <Text style={[styles.closeLinkText, { color: subColor }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={!!pendingRideRequest}
      onRequestClose={() => respond('ignored')}>
      <View style={[styles.backdrop, { backgroundColor: overlayBg }]}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={[styles.iconRing, { borderColor: colors.tint }]}>
            <Text style={styles.iconEmoji}>🚗</Text>
          </View>

          <Text style={[styles.title, { color: textColor }]}>Ride Request</Text>
          <Text style={[styles.requesterName, { color: textColor }]}>
            {pendingRideRequest!.fromName}
          </Text>
          <Text style={[styles.body, { color: subColor }]}>
            wants to share a ride with you going to
          </Text>

          <View style={[styles.destBadge, { backgroundColor: isDark ? '#2c2c2e' : '#f0f0f5' }]}>
            <Text style={styles.destDot}>📍</Text>
            <Text style={[styles.destText, { color: textColor }]} numberOfLines={2}>
              {pendingRideRequest!.toDestination}
            </Text>
          </View>

          {responding ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.tint} />
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#34c759' }]}
                onPress={() => respond('accepted')}
                activeOpacity={0.8}>
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: '#ff3b30' }]}
                onPress={() => respond('denied')}
                activeOpacity={0.8}>
                <Text style={styles.btnText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]}
                onPress={() => respond('ignored')}
                activeOpacity={0.8}>
                <Text style={[styles.btnText, { color: isDark ? '#ebebf5' : '#3a3a3c' }]}>
                  Ignore
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconEmoji: { fontSize: 32 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  requesterName: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 14, textAlign: 'center', marginBottom: 14 },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 4,
  },
  destDot: { fontSize: 16, marginRight: 8 },
  destText: { fontSize: 15, fontWeight: '500', flex: 1 },
  actions: { flexDirection: 'row', marginTop: 24, gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  messageFullBtn: {
    marginTop: 20,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  messageFullBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  closeLinkBtn: { marginTop: 14, paddingVertical: 6 },
  closeLinkText: { fontSize: 14 },
});

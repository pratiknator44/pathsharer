import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { IncomingRideRequest } from './chat-types';

const RIDE_REQUEST_CHANNEL = 'ride-requests';

// When the app is foregrounded, suppress the notification banner since the
// in-app overlay already handles it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForNotifications(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(RIDE_REQUEST_CHANNEL, {
      name: 'Ride Requests',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E6F4FE',
    });
  }
}

export async function sendRideRequestNotification(
  request: IncomingRideRequest,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Ride Request from ${request.fromName}`,
      body: `wants to share a ride to ${request.toDestination}. Open the app to respond.`,
      sound: 'default',
      data: {
        requestId: request.requestId,
        fromUserId: request.fromUserId,
      },
      ...(Platform.OS === 'android' && { channelId: RIDE_REQUEST_CHANNEL }),
    },
    trigger: null, // fire immediately
  });
}

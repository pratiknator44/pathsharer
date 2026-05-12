import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { getIO } from "../sockets";
import { deliverNotification } from "../sockets/notification.socket";

const expo = new Expo({
  // Optional: set EXPO_ACCESS_TOKEN for enhanced delivery reliability
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send an Expo push notification to a single device token.
 * Returns the push ticket (use it later to check delivery status).
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  payload: PushPayload
): Promise<ExpoPushTicket | null> {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.warn(`[Push] Invalid Expo push token: ${expoPushToken}`);
    return null;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: payload.sound ?? "default",
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    badge: payload.badge,
  };

  const [ticket] = await expo.sendPushNotificationsAsync([message]);
  if (ticket.status === "error") {
    console.error(`[Push] Delivery error: ${ticket.message}`, ticket.details);
  }
  return ticket;
}

/**
 * Deliver a notification through both Socket.IO (real-time) and Expo push
 * (background / offline). Supply expoPushToken only when you want a push
 * notification as a fallback.
 */
export async function notify(
  recipientId: string,
  params: {
    type: "message" | "journey" | "match" | "ring" | "system";
    title: string;
    body: string;
    data?: Record<string, unknown>;
    expoPushToken?: string;
  }
): Promise<void> {
  const { expoPushToken, ...notifParams } = params;

  // 1. Persist + deliver via socket
  try {
    const io = getIO();
    await deliverNotification(io, recipientId, notifParams);
  } catch (err) {
    console.warn("[Notify] Socket delivery failed:", (err as Error).message);
  }

  // 2. Send Expo push notification as fallback (e.g. user is offline)
  if (expoPushToken) {
    await sendExpoPushNotification(expoPushToken, {
      title: params.title,
      body: params.body,
      data: params.data,
    });
  }
}

/**
 * Send a ring/call notification — uses a high-priority push so the device
 * wakes even when the app is in the background.
 */
export async function sendRingNotification(
  recipientId: string,
  params: {
    callerName: string;
    journeyId?: string;
    expoPushToken?: string;
  }
): Promise<void> {
  const title = "Incoming Ride Request";
  const body = `${params.callerName} wants to share a ride with you`;
  const data: Record<string, unknown> = {
    type: "ring",
    journeyId: params.journeyId,
  };

  await notify(recipientId, {
    type: "ring",
    title,
    body,
    data,
    expoPushToken: params.expoPushToken,
  });
}

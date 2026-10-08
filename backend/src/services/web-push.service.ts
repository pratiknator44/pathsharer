import webpush from "web-push";
import { User } from "../models/user.model";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function getWebPushPublicKey(): string | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  return publicKey && privateKey ? publicKey : null;
}

function configureWebPush(): boolean {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    process.env.WEB_PUSH_VAPID_SUBJECT || "mailto:support@pathsharer.com",
    publicKey,
    privateKey
  );
  return true;
}

export async function sendWebPushNotification(
  userId: string,
  payload: WebPushPayload
): Promise<void> {
  if (!configureWebPush()) {
    console.warn("[WebPush] VAPID keys are not configured");
    return;
  }

  const user = await User.findById(userId).select("webPushSubscriptions").lean();
  for (const subscription of user?.webPushSubscriptions ?? []) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await User.updateOne(
          { _id: userId },
          { $pull: { webPushSubscriptions: { endpoint: subscription.endpoint } } }
        );
      } else {
        console.error("[WebPush] Delivery failed:", error);
      }
    }
  }
}
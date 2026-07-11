const RING_SOUND_URL = '/music/ring.mp3';
const PING_SOUND_URL = '/music/ping.mp3';

export function canUseBrowserNotifications(): boolean {
  return 'Notification' in window;
}

export function areBrowserNotificationsEnabled(): boolean {
  return canUseBrowserNotifications() && Notification.permission === 'granted';
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!canUseBrowserNotifications()) return 'denied';
  return Notification.requestPermission();
}

export function showRideRequestNotification(params: {
  fromName: string;
  toDestination?: string;
}): void {
  if (!areBrowserNotificationsEnabled()) return;

  const body = params.toDestination
    ? `${params.fromName} wants to connect for a ride towards ${params.toDestination}.`
    : `${params.fromName} wants to connect as your co-passenger.`;

  new Notification('Co-passenger request', {
    body,
    icon: '/logo192.png',
    tag: 'pathsharer-ride-request',
  });
}

export function playRideRequestRing(): void {
  const audio = new Audio(RING_SOUND_URL);
  audio.play().catch(() => {
    // Browsers can block sound until the user has interacted with the page.
  });
}

export function playMessagePing(): void {
  const audio = new Audio(PING_SOUND_URL);
  audio.play().catch(() => {
    // Browsers can block sound until the user has interacted with the page.
  });
}

import { useEffect, useState } from 'react';
import { api } from '../api';
import { canUseBrowserNotifications, requestBrowserNotificationPermission } from '../notificationService';

const AIRPORT_REMINDER_CHOICE_KEY = 'pathsharer_airport_reminder_choice';
const AIRPORT_REMINDER_ENABLED_KEY = 'pathsharer_airport_reminder_enabled';
const WEB_PUSH_ENABLED_KEY = 'pathsharer_web_push_enabled';

type Props = {
  isEligible?: boolean;
  open?: boolean;
  onClose?: () => void;
};

type Stage = 'question' | 'permission' | 'working' | 'complete' | 'error';

function currentPosition(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => reject(new Error('Allow location access in your browser to enable airport reminders.')),
      { maximumAge: 60_000, timeout: 15_000 }
    );
  });
}

function decodeVapidKey(key: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = `${key}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export default function AirportReminderOverlay({ isEligible = false, open = false, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const [stage, setStage] = useState<Stage>('question');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStage('question');
      setIsVisible(true);
      return;
    }
    if (!isEligible || localStorage.getItem(AIRPORT_REMINDER_CHOICE_KEY)) return;
    if (!canUseBrowserNotifications() || Notification.permission !== 'default') return;
    setStage('question');
    setIsVisible(true);
  }, [isEligible, open]);

  async function handleEnable() {
    setStage('working');
    try {
      const permission = await requestBrowserNotificationPermission();
      if (permission !== 'granted') throw new Error('Turn on notifications in your browser settings to continue.');

      await currentPosition();

      localStorage.setItem(AIRPORT_REMINDER_CHOICE_KEY, 'accepted');
      localStorage.setItem(AIRPORT_REMINDER_ENABLED_KEY, 'true');

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const { publicKey } = await api.get<{ publicKey: string }>('/notifications/web-push/key');
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          const readyRegistration = await navigator.serviceWorker.ready;
          const pushRegistration = readyRegistration ?? registration;
          const existing = await pushRegistration.pushManager.getSubscription();
          const subscription = existing ?? await pushRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeVapidKey(publicKey),
          });
          await api.post('/notifications/web-push/subscription', subscription.toJSON());
          localStorage.setItem(WEB_PUSH_ENABLED_KEY, 'true');
        } catch {
          localStorage.removeItem(WEB_PUSH_ENABLED_KEY);
        }
      }

      window.dispatchEvent(new Event('pathsharer:airport-reminders-enabled'));
      setStage('complete');
    } catch (caught) {
      localStorage.setItem(AIRPORT_REMINDER_CHOICE_KEY, 'declined');
      localStorage.removeItem(AIRPORT_REMINDER_ENABLED_KEY);
      setError(caught instanceof Error ? caught.message : 'Could not enable airport reminders.');
      setStage('error');
    }
  }

  function handleDecline() {
    localStorage.setItem(AIRPORT_REMINDER_CHOICE_KEY, 'declined');
    close();
  }

  function close() {
    setIsVisible(false);
    onClose?.();
  }

  if (!isVisible) return null;

  return (
    <div className="notification-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="airport-reminder-title">
      <div className="notification-permission-card">
        <h2 id="airport-reminder-title" className="notification-permission-title">
          {stage === 'question' ? 'Install PathSharer' : stage === 'complete' ? 'Airport reminders are on' : stage === 'error' ? 'Reminders not enabled' : 'Awesome!'}
        </h2>
        <p className="notification-permission-copy">
          {stage === 'question' && "Install PathSharer and we'll remind you to find a copassenger when you're at an airport?"}
          {stage === 'permission' && "Awesome, just turn on the notification and we'll keep you posted."}
          {stage === 'working' && 'Enabling notifications and location reminders…'}
          {stage === 'complete' && 'We will check your location while Pathsharer is open and notify you when you are near an airport.'}
          {stage === 'error' && error}
        </p>
        {stage === 'question' && (
          <div className="notification-permission-actions">
            <button className="notification-primary-btn" onClick={() => setStage('permission')}>OK</button>
            <button className="notification-secondary-btn" onClick={handleDecline}>No</button>
          </div>
        )}
        {stage === 'permission' && (
          <div className="notification-permission-actions">
            <button className="notification-primary-btn" onClick={handleEnable}>Turn on</button>
            <button className="notification-secondary-btn" onClick={handleDecline}>Not now</button>
          </div>
        )}
        {(stage === 'complete' || stage === 'error') && (
          <div className="notification-permission-actions">
            <button className="notification-primary-btn" onClick={close}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
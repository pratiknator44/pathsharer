import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { SocketProvider, useSocket, SOCKET_EVENTS } from './SocketContext';
import SharerPage from './pages/SharerPage';
import InboxPage from './pages/InboxPage';
import ChatPage from './pages/ChatPage';
import CopassengersPage from './pages/CopassengersPage';
import About from './pages/About';
import { playRideRequestRing, showRideRequestNotification } from './notificationService';
import { CURRENT_SEARCH_CHANGED_EVENT, getCurrentSearch } from './currentSearchStore';
import { api } from './api';
import './App.css';
import introImage from "./assets/intro.png";

// Bottom tab bar — hidden on chat, copassengers screens
function BottomNav() {
  const location = useLocation();
  const { unreadCount } = useSocket();
  const [currentSearch, setCurrentSearchState] = useState(() => getCurrentSearch());

  useEffect(() => {
    const updateCurrentSearch = () => setCurrentSearchState(getCurrentSearch());
    window.addEventListener(CURRENT_SEARCH_CHANGED_EVENT, updateCurrentSearch);
    window.addEventListener('storage', updateCurrentSearch);
    updateCurrentSearch();
    return () => {
      window.removeEventListener(CURRENT_SEARCH_CHANGED_EVENT, updateCurrentSearch);
      window.removeEventListener('storage', updateCurrentSearch);
    };
  }, [location.pathname]);

  const hideNav = location.pathname.startsWith('/chat/');

  if (hideNav) return null;

  return (
    <nav className="bottom-nav">

      <NavLink to="/about" className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab--active' : ''}`}>
        <span className="nav-icon-wrap">
          <span className="nav-icon">ⓘ</span>
        </span>
        <span className="nav-label">About</span>
      </NavLink>
      <NavLink to="/" end className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab--active' : ''}`}>
        <span className="nav-icon">🗺️</span>
        <span className="nav-label">Sharer</span>
      </NavLink>
      <NavLink to="/inbox" className={({ isActive }) => `nav-tab ${isActive ? 'nav-tab--active' : ''}`}>
        <span className="nav-icon-wrap">
          <span className="nav-icon">✉️</span>
          {unreadCount > 0 && (
            <span className="nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </span>
        <span className="nav-label">Messages</span>
      </NavLink>
    </nav>
  );
}

function GlobalOverlay() {
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<{
    fromUserId: string;
    fromName: string;
    toDestination: string;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    if (!socket) return;
    const handleIncoming = (payload: any) => {
      setIncoming(payload);
      const fromName = payload.fromName || `Passenger ${payload.fromUserId.substring(0, 8)}`;
      playRideRequestRing();
      showRideRequestNotification({
        fromName,
        toDestination: payload.toDestination,
      });
    };
    socket.on(SOCKET_EVENTS.RIDE_CONNECT_INCOMING, handleIncoming);
    return () => {
      socket.off(SOCKET_EVENTS.RIDE_CONNECT_INCOMING, handleIncoming);
    };
  }, [socket]);

  if (!incoming) return null;

  const handleDecision = (decision: 'accepted' | 'denied' | 'ignored') => {
    if (socket && socket.connected) {
      socket.emit(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE, {
        toUserId: incoming.fromUserId,
        decision,
        requestId: incoming.requestId,
      });
    }
    const userId = incoming.fromUserId;
    const name = incoming.fromName || `Passenger ${incoming.fromUserId.substring(0, 8)}`;
    setIncoming(null);
    if (decision === 'accepted') {
      navigate(`/chat/${userId}`, { state: { name } });
    }
  };

  return (
    <div className="incoming-overlay">
      <div className="incoming-card">
        <div className="incoming-icon-wrap">
          <span className="incoming-icon">👋</span>
        </div>
        <h3 className="incoming-title">Connection Request!</h3>
        <p className="incoming-desc">
          <strong>{incoming.fromName || `Passenger ${incoming.fromUserId.substring(0, 8)}`}</strong> wants to connect to travel towards <strong>{incoming.toDestination}</strong>.
        </p>
        <div className="incoming-actions">
          <button className="incoming-btn incoming-deny" onClick={() => handleDecision('denied')}>Decline</button>
          <button className="incoming-btn incoming-accept" onClick={() => handleDecision('accepted')}>Accept</button>
        </div>
      </div>
    </div>
  );
}

const WELCOME_DISMISSED_KEY = 'pathsharer_welcome_dismissed';

function WelcomeOverlay() {
  const location = useLocation();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(() => {
    return localStorage.getItem(WELCOME_DISMISSED_KEY) !== 'true';
  });

  if (!isVisible || location.pathname !== '/') return null;

  const displayName = user?.name?.trim() || 'Passenger';

  const handleDismiss = () => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <h2 id="welcome-title" className="welcome-title">Welcome to Pathsharer <br /><small>for Airport</small>
        </h2>
        <p className="welcome-copy">
          An early phase open project to help make commuting more affordable.
        </p>
        <div>
          <img src={introImage} width="100%" />
        </div>

        <p className="welcome-name">
          This app doesn&apos;t save any of the user data, kindly lookout for safety.
        </p>

        <p className="welcome-name">
          You&apos;ll appear as <strong>{displayName}</strong> to others.
        </p>

        <p className="welcome-name">
          <small>- Developer -</small>
        </p>

        <button className="welcome-ok-btn" onClick={handleDismiss}>
          I Agree
        </button>
      </div>
    </div >
  );
}

const AIRPORT_REMINDER_ENABLED_KEY = 'pathsharer_airport_reminder_enabled';
const WEB_PUSH_ENABLED_KEY = 'pathsharer_web_push_enabled';

function AirportLocationTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let watchId: number | null = null;
    let lastSentAt = 0;
    let lastCoords: { lat: number; lng: number } | null = null;

    const startWatching = () => {
      if (watchId !== null || localStorage.getItem(AIRPORT_REMINDER_ENABLED_KEY) !== 'true') return;
      if (!navigator.geolocation) return;

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          const movedMeters = lastCoords
            ? distanceMeters(lastCoords, coords)
            : Number.POSITIVE_INFINITY;
          if (Date.now() - lastSentAt < 120_000 || (lastCoords && movedMeters < 250)) return;

          lastSentAt = Date.now();
          lastCoords = coords;
          api.post<{
            nearby: boolean;
            notificationQueued?: boolean;
            airport?: { city: string };
          }>('/notifications/airport-location', { ...coords, userId: user._id }).then((result) => {
            if (
              result.notificationQueued &&
              result.airport &&
              localStorage.getItem(WEB_PUSH_ENABLED_KEY) !== 'true' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              const notification = new Notification('Airport reminder', {
                body: `Traveling to ${result.airport.city}? Tap to find copassengers now`,
                icon: '/logo192.png',
                tag: 'pathsharer-airport-reminder',
              });
              notification.onclick = () => {
                window.focus();
                window.location.assign('/');
              };
            }
          }).catch(() => undefined);
        },
        () => undefined,
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 }
      );
    };

    const stopWatching = () => {
      if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
      watchId = null;
    };

    const onEnabled = () => startWatching();
    const onDisabled = () => stopWatching();
    window.addEventListener('pathsharer:airport-reminders-enabled', onEnabled);
    window.addEventListener('pathsharer:airport-reminders-disabled', onDisabled);
    startWatching();

    return () => {
      stopWatching();
      window.removeEventListener('pathsharer:airport-reminders-enabled', onEnabled);
      window.removeEventListener('pathsharer:airport-reminders-disabled', onDisabled);
    };
  }, [user]);

  return null;
}

function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function AppShell() {
  const { loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <span className="splash-icon">🛣️</span>
          <h1 className="splash-title">PathSharer</h1>
        </div>
        <div className="page-spinner splash-spinner" />
        <p className="splash-sub">Connecting…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <span className="splash-icon">⚠️</span>
          <h1 className="splash-title">Connection Error</h1>
        </div>
        <p className="splash-sub">{error}</p>
        <button className="find-btn find-btn--active" style={{ marginTop: 24 }} onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<SharerPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/chat/:userId" element={<ChatPage />} />
        <Route path="/copassengers" element={<CopassengersPage />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <WelcomeOverlay />
      <AirportLocationTracker />
      <GlobalOverlay />
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

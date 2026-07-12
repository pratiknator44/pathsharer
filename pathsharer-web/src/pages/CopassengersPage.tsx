import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tokenStore } from '../api';
import { SOCKET_EVENTS, useSocket } from '../SocketContext';
import { clearCurrentSearch, getCurrentSearch, setCurrentSearch } from '../currentSearchStore';

const API_URL = process.env.REACT_APP_API_URL?.trim() || '/api/v1';
const ACCEPTED_COPASSENGERS_KEY = 'pathsharer_accepted_copassengers';

interface UserData {
  userId: string;
  name?: string;
  isActive: boolean;
  source: { name: string; coordinates: [number, number] };
  destination: { name: string; coordinates: [number, number] };
  updatedAt: string;
}

interface RouteCoordinates {
  lat: number;
  lng: number;
}

type ConnectStatus = 'idle' | 'connecting' | 'accepted' | 'denied' | 'ignored';
type AcceptedCopassengers = Record<string, string>;

function getAcceptedCopassengers(): AcceptedCopassengers {
  const raw = localStorage.getItem(ACCEPTED_COPASSENGERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AcceptedCopassengers;
  } catch {
    return {};
  }
}

function saveAcceptedCopassenger(userId: string, name: string): void {
  const accepted = getAcceptedCopassengers();
  accepted[userId] = name;
  localStorage.setItem(ACCEPTED_COPASSENGERS_KEY, JSON.stringify(accepted));
}

function getRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diff < 60) return 'Just Now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

export default function CopassengersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, connectionError, sendRideConnectRequest } = useSocket();

  const routeState = location.state as {
    users: UserData[];
    sourceName: string;
    destName: string;
    sourceCoords?: RouteCoordinates;
    destCoords?: RouteCoordinates;
  } | undefined;
  const savedSearch = useMemo(() => getCurrentSearch(), []);
  const state = routeState ?? savedSearch;
  const [users, setUsers] = useState<UserData[]>(() => state?.users ?? []);
  const [sourceName, setSourceName] = useState(state?.sourceName ?? '');
  const [destName, setDestName] = useState(state?.destName ?? '');
  const [sourceCoords, setSourceCoords] = useState<RouteCoordinates | null>(() => state?.sourceCoords ?? null);
  const [destCoords, setDestCoords] = useState<RouteCoordinates | null>(() => state?.destCoords ?? null);
  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Updating list...');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestMap = useRef<Record<string, string>>({});
  const userNameMap = useRef<Record<string, string>>({});

  useEffect(() => {
    setUsers(state?.users ?? []);
    setSourceName(state?.sourceName ?? '');
    setDestName(state?.destName ?? '');
    setSourceCoords(state?.sourceCoords ?? null);
    setDestCoords(state?.destCoords ?? null);
  }, [state?.users, state?.sourceName, state?.destName, state?.sourceCoords, state?.destCoords]);

  useEffect(() => {
    const accepted = getAcceptedCopassengers();
    const nextStatus: Record<string, ConnectStatus> = {};

    users.forEach((item) => {
      const fallbackName = item.name || `Passenger ${item.userId.substring(0, 8)}`;
      userNameMap.current[item.userId] = accepted[item.userId] || fallbackName;
      if (accepted[item.userId]) {
        nextStatus[item.userId] = 'accepted';
      }
    });

    if (Object.keys(nextStatus).length > 0) {
      setConnectStatus((prev) => ({ ...nextStatus, ...prev }));
    }
  }, [users]);

  useEffect(() => {
    if (isRefreshing || !lastUpdatedAt) {
      setStatusText('Updating list...');
      return;
    }

    const updateStatus = () => {
      const secondsAgo = Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
      setStatusText(secondsAgo === 0 ? 'Updated just now' : `Updated ${secondsAgo} seconds ago`);
    };

    updateStatus();
    const timerId = window.setInterval(updateStatus, 1000);
    return () => window.clearInterval(timerId);
  }, [isRefreshing, lastUpdatedAt]);

  useEffect(() => {
    if (!sourceCoords || !destCoords) return;

    let cancelled = false;
    const refreshNearbyUsers = async () => {
      const token = tokenStore.get();
      if (!token) return;

      setIsRefreshing(true);
      setStatusText('Updating list...');

      try {
        const nearbyRes = await fetch(
          `${API_URL}/active-users/nearby?srcLng=${sourceCoords.lng}&srcLat=${sourceCoords.lat}&dstLng=${destCoords.lng}&dstLat=${destCoords.lat}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!nearbyRes.ok) throw new Error(`Server error ${nearbyRes.status}`);

        const nearbyBody = await nearbyRes.json();
        const nextUsers = nearbyBody.data || [];

        if (!cancelled) {
          setUsers(nextUsers);
          setLastUpdatedAt(Date.now());
          setCurrentSearch({
            users: nextUsers,
            sourceName,
            destName,
            sourceCoords,
            destCoords,
          });
        }
      } catch {
        if (!cancelled) {
          setStatusText('Could not update list');
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    void refreshNearbyUsers();
    const intervalId = window.setInterval(() => {
      void refreshNearbyUsers();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sourceCoords?.lat, sourceCoords?.lng, destCoords?.lat, destCoords?.lng, sourceName, destName]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const handleMessage = useCallback((userId: string) => {
    const name = userNameMap.current[userId] ?? 'Passenger';
    navigate(`/chat/${userId}`, { state: { name } });
  }, [navigate]);

  useEffect(() => {
    if (!socket) return;
    function handleResponseResult(result: { requestId: string; decision: ConnectStatus }) {
      const targetUserId = requestMap.current[result.requestId];
      if (!targetUserId) return;
      if (result.decision === 'accepted') {
        saveAcceptedCopassenger(targetUserId, userNameMap.current[targetUserId] ?? 'Passenger');
      }
      setConnectStatus((prev) => ({ ...prev, [targetUserId]: result.decision }));
    }
    socket.on(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE_RESULT, handleResponseResult);
    return () => { socket.off(SOCKET_EVENTS.RIDE_CONNECT_RESPONSE_RESULT, handleResponseResult); };
  }, [socket]);

  const handleConnect = useCallback((item: UserData) => {
    const status = connectStatus[item.userId] ?? 'idle';
    if (status === 'accepted') {
      handleMessage(item.userId);
      return;
    }

    if (!socket || !socket.connected) {
      showToast(connectionError ? `Socket error: ${connectionError}` : 'Connecting to server. Please try again in a moment.');
      return;
    }
    if (status !== 'idle') return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    requestMap.current[requestId] = item.userId;
    userNameMap.current[item.userId] = item.name || `Passenger ${item.userId.substring(0, 8)}`;

    setConnectStatus((prev) => ({ ...prev, [item.userId]: 'connecting' }));
    const sent = sendRideConnectRequest({
      toUserId: item.userId,
      toDestination: destName || 'unknown destination',
      requestId,
    });

    if (!sent) {
      delete requestMap.current[requestId];
      setConnectStatus((prev) => ({ ...prev, [item.userId]: 'idle' }));
      showToast(connectionError ? `Socket error: ${connectionError}` : 'Connecting to server. Please try again in a moment.');
    }
  }, [socket, connectionError, connectStatus, destName, sendRideConnectRequest, handleMessage]);

  const handleCancel = useCallback(async () => {
    if (!window.confirm('This will remove you from co-passenger search. Continue?')) return;
    setCancelling(true);
    try {
      const token = tokenStore.get();
      // deregisters from redis
      await fetch(`${API_URL}/active-users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
    } catch { }
    finally {
      clearCurrentSearch();
      setCancelling(false);
      navigate(-1);
    }
  }, [navigate]);

  return (
    <div className="cop-root">
      {/* Header */}
      <div className="cop-header">
        <div className="cop-header-top">
          <button className="cop-back-btn" onClick={() => navigate(-1)}>← Back</button>
          <button
            className="cop-cancel-btn"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? <span className="page-spinner small-spinner" /> : '✕ Cancel Search'}
          </button>
        </div>
        <h1 className="cop-title">Potential Co-passengers</h1>
      </div>

      {/* Route summary */}
      <div className="cop-route-summary">
        <span className="cop-route-label">Your Route</span>
        <div className="cop-route-row">
          <span className="route-dot green-dot" />
          <span className="cop-route-text">{sourceName}</span>
        </div>
        <div className="cop-route-row">
          <span className="route-dot red-dot" />
          <span className="cop-route-text">{destName}</span>
        </div>
      </div>

      <div className="cop-status-row" style={{ marginBottom: 12, fontSize: 13, color: '#64748b' }}>
        <span>{statusText}</span>
      </div>

      {/* User cards */}
      <div className="cop-list">
        {users.length === 0 ? (
          <div className="centered-state">
            <div className="empty-icon">🔍</div>
            <p className="empty-title">Expanding search</p>
            <p className="empty-sub">No one has registered for same route. We'll notify you when someone does.</p>
          </div>
        ) : (
          users.map((item) => {
            const status: ConnectStatus = connectStatus[item.userId] ?? 'idle';
            const isDisabled = status !== 'idle' && status !== 'accepted';
            const isAccepted = status === 'accepted';

            const btnClass =
              status === 'accepted' ? 'connect-btn btn-accepted' :
                status === 'denied' ? 'connect-btn btn-denied' :
                  status === 'ignored' ? 'connect-btn btn-ignored' :
                    status === 'connecting' ? 'connect-btn btn-connecting' :
                      'connect-btn btn-idle';

            return (
              <div key={item.userId} className="cop-card">
                <div className="cop-card-header">
                  <div className="cop-passenger-id">
                    <span className="passenger-icon">👤</span>
                    {item?.name}
                  </div>
                  <span className="cop-time">{getRelativeTime(item.updatedAt)}</span>
                </div>

                <div className="cop-location-row">
                  <span className="route-dot green-dot small-dot" />
                  <span className="cop-loc-text">{item.source?.name}</span>
                </div>
                <div className="cop-location-row">
                  <span className="route-dot red-dot small-dot" />
                  <span className="cop-loc-text">{item.destination?.name}</span>
                </div>

                <div className="cop-btn-row">
                  <button
                    className={btnClass}
                    disabled={isDisabled}
                    onClick={() => handleConnect(item)}
                    style={{ flex: isAccepted ? 1 : undefined }}
                  >
                    {status === 'connecting' && <span className="page-spinner small-spinner" />}
                    {statusLabel(status)}
                  </button>
                  {isAccepted && (
                    <button
                      className="msg-btn"
                      onClick={() => handleMessage(item.userId)}
                    >
                      💬
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}

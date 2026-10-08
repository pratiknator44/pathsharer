import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, tokenStore } from '../api';
import {
  areBrowserNotificationsEnabled,
  canUseBrowserNotifications,
  requestBrowserNotificationPermission,
} from '../notificationService';
import { setCurrentSearch } from '../currentSearchStore';
import AirportReminderOverlay from '../components/AirportReminderOverlay';

const API_URL = getApiBaseUrl();
const GEOAPIFY_KEY = process.env.REACT_APP_GEOAPIFY_KEY ?? 'd765840f666d4c9da4428757bee3d82e';
const SOURCE_SUGGESTION_RADIUS_KM = Number.isFinite(Number.parseFloat(process.env.REACT_APP_SOURCE_SUGGESTION_RADIUS_KM ?? ''))
  ? Number.parseFloat(process.env.REACT_APP_SOURCE_SUGGESTION_RADIUS_KM ?? '')
  : 75;
const DEST_SUGGESTION_RADIUS_KM = Number.isFinite(Number.parseFloat(process.env.REACT_APP_DEST_SUGGESTION_RADIUS_KM ?? ''))
  ? Number.parseFloat(process.env.REACT_APP_DEST_SUGGESTION_RADIUS_KM ?? '')
  : 250;

const TILE_URL =
  'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=' + GEOAPIFY_KEY;

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
const sourceIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
const destIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type LatLng = { lat: number; lng: number };

type Suggestion = {
  place_id: string;
  formatted: string;
  lat: number;
  lon: number;
};

type RecentSearch = { name: string; coordinates: [number, number] };

function getDistanceKm(from: LatLng, to: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function filterSuggestionsByRadius(suggestions: Suggestion[], center: LatLng | null, radiusKm: number | null) {
  if (!center || radiusKm == null || !Number.isFinite(radiusKm)) return suggestions;
  return suggestions.filter((suggestion) => {
    const distanceKm = getDistanceKm(center, { lat: suggestion.lat, lng: suggestion.lon });
    return distanceKm <= radiusKm;
  });
}

async function geocodeAutocomplete(text: string, center: LatLng | null = null, radiusKm: number | null = null): Promise<Suggestion[]> {
  if (text.trim().length < 2) return [];
  const url =
    'https://api.geoapify.com/v1/geocode/autocomplete?text=' +
    encodeURIComponent(text) +
    '&limit=5&format=json&apiKey=' +
    GEOAPIFY_KEY;

  const fetchSuggestions = async (applyRadius: boolean): Promise<Suggestion[]> => {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const suggestions = (data.results ?? []).map((r: any) => ({
        place_id: r.place_id ?? String(Math.random()),
        formatted: r.formatted ?? '',
        lat: r.lat,
        lon: r.lon,
      }));
      return applyRadius ? filterSuggestionsByRadius(suggestions, center, radiusKm) : suggestions;
    } catch {
      return [];
    }
  };

  try {
    const radiusFiltered = await fetchSuggestions(true);
    if (radiusFiltered.length > 0 || !center || radiusKm == null || !Number.isFinite(radiusKm)) {
      return radiusFiltered;
    }

    return fetchSuggestions(false);
  } catch {
    return [];
  }
}

async function fetchRoute(
  from: LatLng,
  to: LatLng
): Promise<{ points: [number, number][]; distanceKm: number } | null> {
  const url =
    `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lng}|${to.lat},${to.lng}&mode=drive&apiKey=${GEOAPIFY_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const distM: number = feature.properties?.distance ?? 0;
    const geom = feature.geometry;
    const points: [number, number][] = [];
    if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        for (const [lon, lat] of line) points.push([lat, lon]);
      }
    } else if (geom.type === 'LineString') {
      for (const [lon, lat] of geom.coordinates) points.push([lat, lon]);
    }
    return { points, distanceKm: distM / 1000 };
  } catch {
    return null;
  }
}

// Inner component that can access the map instance
function MapController({ center, routePoints, sourceCoords, destCoords }: { center: LatLng | null; routePoints: [number, number][]; sourceCoords: LatLng | null; destCoords: LatLng | null }) {
  const map = useMap();

  useEffect(() => {
    if (sourceCoords && destCoords) {
      const bounds = [
        [sourceCoords.lat, sourceCoords.lng],
        [destCoords.lat, destCoords.lng]
      ];
      map.fitBounds(bounds as any, { padding: [80, 40] });
    } else if (routePoints.length > 1) {
      map.fitBounds(routePoints as any, { padding: [80, 40] });
    } else if (center) {
      map.setView([center.lat, center.lng], 16, { animate: true });
    }
  }, [center, routePoints, sourceCoords, destCoords, map]);

  return null;
}

export default function SharerPage() {
  const navigate = useNavigate();

  const [gpsCoords, setGpsCoords] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>({ lat: 20.5937, lng: 78.9629 });

  // Source
  const [sourceText, setSourceText] = useState('');
  const [sourceCoords, setSourceCoords] = useState<LatLng | null>(null);
  const [sourceSuggestions, setSourceSuggestions] = useState<Suggestion[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [showSourceDrop, setShowSourceDrop] = useState(false);

  // Destination
  const [destText, setDestText] = useState('');
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [destLoading, setDestLoading] = useState(false);
  const [showDestDrop, setShowDestDrop] = useState(false);

  // Route
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  // Location permission dialog
  // 'pending' = show dialog, 'granted' = have coords, 'denied' = user declined
  const savedLocPerm = localStorage.getItem('locationPermission') as 'granted' | 'denied' | null;
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>(
    savedLocPerm ?? 'pending'
  );
  const [locationFetching, setLocationFetching] = useState(false);
  const [locationError, setLocationError] = useState(false);

  // If previously granted, silently fetch GPS on mount (no dialog shown)
  useEffect(() => {
    if (savedLocPerm === 'granted') {
      setLocationFetching(true);
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsCoords(coords);
          setMapCenter(coords);
          setLocationFetching(false);
          setLocationError(false);
          setSourceText('Your Location');
          setSourceCoords(coords);
        },
        () => {
          setLocationFetching(false);
          // Reset so dialog shows again next time — device location may have been toggled off
          localStorage.removeItem('locationPermission');
          setLocationPermission('pending');
          setLocationError(true);
        }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  const srcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    fetch(`${API_URL}/users/me/recent-searches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((b) => setRecentSearches(b.data ?? []))
      .catch(() => { });
  }, []);

  // Auto-fetch route when both coords set
  useEffect(() => {
    if (!sourceCoords || !destCoords) return;
    let cancelled = false;
    setRouteLoading(true);
    setRoutePoints([]);
    setDistanceKm(null);
    fetchRoute(sourceCoords, destCoords).then((result) => {
      if (cancelled) return;
      setRouteLoading(false);
      if (result) {
        setRoutePoints(result.points);
        setDistanceKm(result.distanceKm);
      }
    });
    return () => { cancelled = true; };
  }, [sourceCoords, destCoords]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Location permission handlers
  function handleEnableLocation() {
    // Close dialog immediately and show loading in the source input
    setLocationPermission('granted');
    localStorage.setItem('locationPermission', 'granted');
    setLocationFetching(true);
    setLocationError(false);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        setMapCenter(coords);
        setLocationFetching(false);
        setLocationError(false);
        // Autofill source with user location
        setSourceText('Your Location');
        setSourceCoords(coords);
      },
      () => {
        setLocationFetching(false);
        setLocationPermission('denied');
        localStorage.setItem('locationPermission', 'denied');
        setLocationError(true);
      }
    );
  }

  function handleDenyLocation() {
    setLocationPermission('denied');
  }

  async function saveRecentSearch(name: string, coordinates: [number, number]) {
    const token = tokenStore.get();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users/me/recent-searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, coordinates }),
      });
      if (res.ok) {
        setRecentSearches((prev) => {
          const filtered = prev.filter((r) => r.name !== name);
          return [{ name, coordinates }, ...filtered].slice(0, 5);
        });
      }
    } catch { }
  }

  // Source handlers
  function handleSourceChange(text: string) {
    setSourceText(text);
    setSourceCoords(null);
    setRoutePoints([]);
    setDistanceKm(null);
    setShowSourceDrop(true);
    setDestSuggestions([]);
    if (srcTimer.current) clearTimeout(srcTimer.current);
    if (text.trim().length < 2) { setSourceSuggestions([]); return; }
    srcTimer.current = setTimeout(async () => {
      setSourceLoading(true);
      const results = await geocodeAutocomplete(text, gpsCoords, SOURCE_SUGGESTION_RADIUS_KM);
      setSourceLoading(false);
      setSourceSuggestions(results);
    }, 350);
  }

  function selectSource(s: Suggestion) {
    setSourceText(s.formatted);
    setSourceCoords({ lat: s.lat, lng: s.lon });
    setSourceSuggestions([]);
    setShowSourceDrop(false);
    setMapCenter({ lat: s.lat, lng: s.lon });
    saveRecentSearch(s.formatted, [s.lon, s.lat]);
  }

  function useGpsAsSource() {
    if (!gpsCoords) return;
    setSourceText('Your Location');
    setSourceCoords(gpsCoords);
    setSourceSuggestions([]);
    setShowSourceDrop(false);
  }

  // Destination handlers
  function handleDestChange(text: string) {
    setDestText(text);
    setDestCoords(null);
    setRoutePoints([]);
    setDistanceKm(null);
    setShowDestDrop(true);
    setSourceSuggestions([]);
    if (dstTimer.current) clearTimeout(dstTimer.current);
    if (text.trim().length < 2) { setDestSuggestions([]); return; }
    dstTimer.current = setTimeout(async () => {
      setDestLoading(true);
      const results = await geocodeAutocomplete(text, gpsCoords, DEST_SUGGESTION_RADIUS_KM);
      setDestLoading(false);
      setDestSuggestions(results);
    }, 350);
  }

  function selectDest(s: Suggestion) {
    setDestText(s.formatted);
    setDestCoords({ lat: s.lat, lng: s.lon });
    setDestSuggestions([]);
    setShowDestDrop(false);
    setMapCenter({ lat: s.lat, lng: s.lon });
    saveRecentSearch(s.formatted, [s.lon, s.lat]);
  }

  function useGpsAsDest() {
    if (!gpsCoords) return;
    setDestText('Your Location');
    setDestCoords(gpsCoords);
    setDestSuggestions([]);
    setShowDestDrop(false);
  }

  function handleSwap() {
    const tText = sourceText;
    const tCoords = sourceCoords;
    setSourceText(destText);
    setSourceCoords(destCoords);
    setDestText(tText);
    setDestCoords(tCoords);
    setRoutePoints([]);
    setDistanceKm(null);
    setShowSourceDrop(false);
    setShowDestDrop(false);
  }

  async function startFindCoPassengers() {
    if (!sourceCoords || !destCoords) return;
    const token = tokenStore.get();
    if (!token) { showToast('Please log in first'); return; }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/active-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          isActive: true,
          source: { name: sourceText || 'Source', coordinates: [sourceCoords.lng, sourceCoords.lat] },
          destination: { name: destText || 'Destination', coordinates: [destCoords.lng, destCoords.lat] },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error ?? `Server error ${res.status}`);
      }

      const nearbyRes = await fetch(
        `${API_URL}/active-users/nearby?srcLng=${sourceCoords.lng}&srcLat=${sourceCoords.lat}&dstLng=${destCoords.lng}&dstLat=${destCoords.lat}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!nearbyRes.ok) throw new Error(`Server error ${nearbyRes.status}`);

      const nearbyBody = await nearbyRes.json();
      const users = nearbyBody.data || [];
      const currentSearch = {
        users,
        sourceName: sourceText || 'Source',
        destName: destText || 'Destination',
        sourceCoords: sourceCoords ? { lat: sourceCoords.lat, lng: sourceCoords.lng } : undefined,
        destCoords: destCoords ? { lat: destCoords.lat, lng: destCoords.lng } : undefined,
      };
      setCurrentSearch(currentSearch);

      // if (users.length === 0) {
      //   showToast('No co-passengers nearby');
      // } else {
      navigate('/copassengers', { state: currentSearch });
      // }
    } catch (err: any) {
      showToast(err?.message ?? 'Could not save your location. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleFindCoPassengers() {
    if (!sourceCoords || !destCoords || saving) return;

    if (canUseBrowserNotifications() && !areBrowserNotificationsEnabled()) {
      setShowNotificationPrompt(true);
      return;
    }

    await startFindCoPassengers();
  }

  async function handleEnableNotifications() {
    const permission = await requestBrowserNotificationPermission();
    setShowNotificationPrompt(false);

    if (permission !== 'granted') {
      showToast('Notifications are off. You can still find co-passengers here.');
    }

    await startFindCoPassengers();
  }

  async function handleSkipNotifications() {
    setShowNotificationPrompt(false);
    await startFindCoPassengers();
  }

  const canSearch = !!sourceCoords && !!destCoords;

  return (
    <div className="sharer-root">

      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={12}
        className="sharer-map"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={TILE_URL} maxZoom={19} />
        <MapController center={mapCenter} routePoints={routePoints} sourceCoords={sourceCoords} destCoords={destCoords} />
        {sourceCoords && <Marker position={[sourceCoords.lat, sourceCoords.lng]} icon={sourceIcon} />}
        {destCoords && <Marker position={[destCoords.lat, destCoords.lng]} icon={destIcon} />}
        {routePoints.length > 1 && (
          <Polyline positions={routePoints} color="#6C63FF" weight={4} opacity={0.9} />
        )}
      </MapContainer>

      {/* Overlay panel */}
      <div className="sharer-overlay">
        {/* Route card */}
        <div className="route-card">
          <button className="swap-btn" onClick={handleSwap} title="Swap">⇅</button>

          {/* Source row */}
          <div className="route-row">
            <span className="route-dot green-dot" />
            <div className="input-wrap">
              <input
                id="source-input"
                className={`route-input${locationFetching ? ' route-input--fetching' : ''}`}
                placeholder={locationFetching ? 'Getting location…' : 'From where?'}
                value={sourceText}
                onChange={(e) => handleSourceChange(e.target.value)}
                onFocus={() => { setShowSourceDrop(true); setShowDestDrop(false); }}
                onBlur={() => setTimeout(() => setShowSourceDrop(false), 200)}
                autoComplete="off"
                disabled={locationFetching}
              />
              {(sourceLoading || locationFetching) && <span className="input-spinner" />}
            </div>
          </div>

          <div className="route-connector">
            <div className="connector-line" />
          </div>

          {/* Destination row */}
          <div className="route-row">
            <span className="route-dot red-dot" />
            <div className="input-wrap">
              <input
                id="dest-input"
                className="route-input"
                placeholder="Where to?"
                value={destText}
                onChange={(e) => handleDestChange(e.target.value)}
                onFocus={() => { setShowDestDrop(true); setShowSourceDrop(false); }}
                onBlur={() => setTimeout(() => setShowDestDrop(false), 200)}
                autoComplete="off"
              />
              {destLoading && <span className="input-spinner" />}
            </div>
          </div>

          {/* Location error banner */}
          {locationError && (
            <div className="location-error-banner">
              <span className="location-error-msg">📍 Couldn't get your location. Make sure Location is enabled on your device.</span>
              <button className="location-retry-btn" onClick={handleEnableLocation}>Try Again</button>
            </div>
          )}
        </div>

        {/* Source dropdown */}
        {showSourceDrop && (
          <div className="sugg-box">
            <button className="sugg-item your-loc" onMouseDown={useGpsAsSource}>
              <span className="sugg-dot green-dot" />
              <div className="sugg-text-wrap">
                <span className="sugg-main">Your Location</span>
                {gpsCoords && (
                  <span className="sugg-sub">{gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
                )}
              </div>
            </button>

            {sourceText.trim().length < 2 && recentSearches.length > 0 && (
              <>
                <div className="sugg-section-label">Recent</div>
                {recentSearches.map((r, i) => (
                  <button
                    key={`rsrc-${i}`}
                    className="sugg-item"
                    onMouseDown={() =>
                      selectSource({ place_id: `r${i}`, formatted: r.name, lat: r.coordinates[1], lon: r.coordinates[0] })
                    }
                  >
                    <span className="sugg-hist-icon">🕐</span>
                    <span className="sugg-main">{r.name}</span>
                  </button>
                ))}
              </>
            )}

            {sourceLoading && sourceSuggestions.length === 0 && (
              <div className="sugg-item sugg-loading"><span className="input-spinner" /></div>
            )}

            {sourceSuggestions.map((s) => (
              <button key={s.place_id} className="sugg-item" onMouseDown={() => selectSource(s)}>
                <span className="sugg-pin">📍</span>
                <span className="sugg-main">{s.formatted}</span>
              </button>
            ))}
          </div>
        )}

        {/* Dest dropdown */}
        {showDestDrop && (
          <div className="sugg-box">
            <button className="sugg-item your-loc" onMouseDown={useGpsAsDest}>
              <span className="sugg-dot green-dot" />
              <div className="sugg-text-wrap">
                <span className="sugg-main">Your Location</span>
                {gpsCoords && (
                  <span className="sugg-sub">{gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
                )}
              </div>
            </button>

            {destText.trim().length < 2 && recentSearches.length > 0 && (
              <>
                <div className="sugg-section-label">Recent</div>
                {recentSearches.map((r, i) => (
                  <button
                    key={`rdst-${i}`}
                    className="sugg-item"
                    onMouseDown={() =>
                      selectDest({ place_id: `r${i}`, formatted: r.name, lat: r.coordinates[1], lon: r.coordinates[0] })
                    }
                  >
                    <span className="sugg-hist-icon">🕐</span>
                    <span className="sugg-main">{r.name}</span>
                  </button>
                ))}
              </>
            )}

            {destLoading && destSuggestions.length === 0 && (
              <div className="sugg-item sugg-loading"><span className="input-spinner" /></div>
            )}

            {destSuggestions.map((s) => (
              <button key={s.place_id} className="sugg-item" onMouseDown={() => selectDest(s)}>
                <span className="sugg-pin">📍</span>
                <span className="sugg-main">{s.formatted}</span>
              </button>
            ))}
          </div>
        )}

        {/* Route info pill */}
        {(routeLoading || distanceKm !== null) && (
          <div className="route-info-pill">
            {routeLoading ? (
              <><span className="input-spinner" /><span style={{ marginLeft: 8 }}>Calculating route…</span></>
            ) : (
              <span>📍 {distanceKm?.toFixed(1)} km</span>
            )}
          </div>
        )}

        <div className="sharer-spacer" />

        {/* Find co-passengers button */}
        <button
          id="find-copassengers-btn"
          className={`find-btn ${canSearch ? 'find-btn--active' : 'find-btn--disabled'}`}
          onClick={handleFindCoPassengers}
          disabled={!canSearch || saving}
        >
          {saving ? (
            <><span className="btn-spinner" /> Searching…</>
          ) : (
            '🔍 Find Co-passengers'
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="toast-msg">{toast}</div>}

      {/* Location Permission Dialog */}
      {locationPermission === 'pending' && (
        <div className="notification-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title">
          <div className="notification-permission-card">
            <div className="location-dialog-icon">📍</div>
            <h2 id="location-dialog-title" className="notification-permission-title">
              Allow Location Access
            </h2>
            <p className="notification-permission-copy">
              PathSharer uses your location to autofill your starting point and centre the map on you — making it faster to share your ride.
            </p>
            <div className="notification-permission-actions">
              {/* <button className="notification-secondary-btn" onClick={handleDenyLocation}>
                Not now
              </button> */}
              <button className="notification-primary-btn" onClick={handleEnableLocation}>
                Enable Location
              </button>
            </div>
          </div>
        </div>
      )}

      <AirportReminderOverlay isEligible={locationPermission !== 'pending' && !locationFetching} />

      {showNotificationPrompt && (
        <div className="notification-permission-overlay" role="dialog" aria-modal="true" aria-labelledby="notification-permission-title">
          <div className="notification-permission-card">
            <h2 id="notification-permission-title" className="notification-permission-title">
              Stay ready for ride requests
            </h2>
            <p className="notification-permission-copy">
              We can notify you the moment another traveler requests you as a co-passenger, so you do not miss a match while this page is open.
            </p>
            <div className="notification-permission-actions">
              <button className="notification-secondary-btn" onClick={handleSkipNotifications}>
                Not now
              </button>
              <button className="notification-primary-btn" onClick={handleEnableNotifications}>
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saving overlay */}
      {saving && (
        <div className="saving-overlay">
          <div className="saving-card">
            <span className="btn-spinner large-spinner" />
            <p>Finding co-passengers…</p>
          </div>
        </div>
      )}
    </div>
  );
}

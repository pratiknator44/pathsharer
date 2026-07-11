import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Polyline, UrlTile } from 'react-native-maps';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { getAuthToken } from '@/utils/storage';

const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY ?? 'GEOAPIFY_API_KEY';
const TILE_URL_LIGHT =
  'https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=' + GEOAPIFY_KEY;
const TILE_URL_DARK =
  'https://maps.geoapify.com/v1/tile/dark-matter/{z}/{x}/{y}.png?apiKey=' + GEOAPIFY_KEY;

const DEFAULT_REGION = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

type PermissionState = 'checking' | 'granted' | 'denied';
type LatLng = { latitude: number; longitude: number };

type Suggestion = {
  place_id: string;
  formatted: string;
  lat: number;
  lon: number;
};

async function geocodeAutocomplete(text: string): Promise<Suggestion[]> {
  if (text.trim().length < 2) return [];
  const url =
    'https://api.geoapify.com/v1/geocode/autocomplete?text=' +
    encodeURIComponent(text) +
    '&limit=5&format=json&apiKey=' +
    GEOAPIFY_KEY;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as { results?: any[] };
    return (data.results ?? []).map((r: any) => ({
      place_id: (r.place_id as string) ?? String(Math.random()),
      formatted: (r.formatted as string) ?? '',
      lat: r.lat as number,
      lon: r.lon as number,
    }));
  } catch {
    return [];
  }
}

async function fetchRoute(
  from: LatLng,
  to: LatLng,
): Promise<{ points: LatLng[]; distanceKm: number } | null> {
  const url =
    'https://api.geoapify.com/v1/routing?waypoints=' +
    from.latitude +
    ',' +
    from.longitude +
    '|' +
    to.latitude +
    ',' +
    to.longitude +
    '&mode=drive&apiKey=' +
    GEOAPIFY_KEY;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as { features?: any[] };
    const feature = data.features?.[0];
    if (feature == null) return null;
    const distM: number = (feature.properties?.distance as number) ?? 0;
    const geom = feature.geometry as { type: string; coordinates: any };
    const points: LatLng[] = [];
    if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates as number[][][]) {
        for (const [lon, lat] of line) {
          points.push({ latitude: lat, longitude: lon });
        }
      }
    } else if (geom.type === 'LineString') {
      for (const [lon, lat] of geom.coordinates as number[][]) {
        points.push({ latitude: lat, longitude: lon });
      }
    }
    return { points, distanceKm: distM / 1000 };
  } catch {
    return null;
  }
}

export default function SharerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const mapRef = useRef<MapView>(null);
  const { userGender } = useAuth();
  const router = useRouter();

  const [permission, setPermission] = useState<PermissionState>('checking');
  const [gpsCoords, setGpsCoords] = useState<LatLng | null>(null);

  // Source
  const [sourceText, setSourceText] = useState('');
  const [sourceCoords, setSourceCoords] = useState<LatLng | null>(null);
  const [sourceSuggestions, setSourceSuggestions] = useState<Suggestion[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Destination
  const [destText, setDestText] = useState('');
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [destLoading, setDestLoading] = useState(false);

  // Dropdown visibility — tracked independently so onBlur delay doesn't race with onPress
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Route
  const [routePoints, setRoutePoints] = useState<LatLng[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Female-only preference (only relevant when userGender === 'female')
  const [femaleOnly, setFemaleOnly] = useState(false);

  // API call state
  const [savingLocation, setSavingLocation] = useState(false);

  // Recent searches from backend
  const [recentSearches, setRecentSearches] = useState<Array<{ name: string; coordinates: [number, number] }>>([]);

  async function handleFindCoPassengers() {
    if (sourceCoords === null || destCoords === null) return;

    const token = await getAuthToken();
    if (!token) {
      Alert.alert('Not signed in', 'Please log in to find co-passengers.');
      return;
    }

    setSavingLocation(true);
    try {
      const res = await fetch(`${API_URL}/active-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: true,
          source: {
            name: sourceText || 'Source',
            coordinates: [sourceCoords.longitude, sourceCoords.latitude],
          },
          destination: {
            name: destText || 'Destination',
            coordinates: [destCoords.longitude, destCoords.latitude],
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error ?? `Server error ${res.status}`);
      }

      // 1. When 200 is received, send the coordinates to /nearby api call
      const nearbyRes = await fetch(`${API_URL}/active-users/nearby?srcLng=${sourceCoords.longitude}&srcLat=${sourceCoords.latitude}&dstLng=${destCoords.longitude}&dstLat=${destCoords.latitude}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!nearbyRes.ok) {
        throw new Error(`Server error ${nearbyRes.status} while fetching nearby users`);
      }

      const nearbyBody = await nearbyRes.json();
      const users = nearbyBody.data || [];

      // 3. If no user is found just toast the message "No copassengers nearby :( "
      if (users.length === 0) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('No copassengers nearby :(', ToastAndroid.SHORT);
        } else {
          Alert.alert('No copassengers', 'No copassengers nearby :(');
        }
      } else {
        // 2. Navigate to "Potential Copassengers" screen
        router.push({
          pathname: '/potential-copassengers',
          params: {
            users: JSON.stringify(users),
            sourceName: sourceText || 'Source',
            destName: destText || 'Destination'
          }
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save your location. Try again.');
    } finally {
      setSavingLocation(false);
    }
  }

  const sourceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function requestLocation() {
    setPermission('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }
      // Permission granted — show the map immediately, then get coords in background
      setPermission('granted');
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        setGpsCoords({ latitude, longitude });
        mapRef.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
          800,
        );
      } catch {
        // Couldn't get position, but permission is granted — show map at default region
      }
    } catch {
      setPermission('denied');
    }
  }

  useEffect(() => { requestLocation(); }, []); // mount-only

  useEffect(() => {
    async function loadRecentSearches() {
      const token = await getAuthToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/users/me/recent-searches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        setRecentSearches(body.data ?? []);
      } catch {
        // silent fail
      }
    }
    loadRecentSearches();
  }, []);

  // Auto-fetch route when both coords are ready
  useEffect(() => {
    if (sourceCoords === null || destCoords === null) return;
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
        mapRef.current?.fitToCoordinates(result.points, {
          edgePadding: { top: 160, right: 40, bottom: 120, left: 40 },
          animated: true,
        });
      }
    });
    return () => { cancelled = true; };
  }, [sourceCoords, destCoords]);

  function handleSourceChange(text: string) {
    setSourceText(text);
    setSourceCoords(null);
    setRoutePoints([]);
    setDistanceKm(null);
    setShowSourceDropdown(true);
    setDestSuggestions([]);        // hide dest list when source is active
    if (sourceTimer.current) clearTimeout(sourceTimer.current);
    if (text.trim().length < 2) { setSourceSuggestions([]); return; }
    sourceTimer.current = setTimeout(async () => {
      setSourceLoading(true);
      const results = await geocodeAutocomplete(text);
      setSourceLoading(false);
      setSourceSuggestions(results);
    }, 350);
  }

  function handleDestChange(text: string) {
    setDestText(text);
    setDestCoords(null);
    setRoutePoints([]);
    setDistanceKm(null);
    setShowDestDropdown(true);
    setSourceSuggestions([]);      // hide source list when dest is active
    if (destTimer.current) clearTimeout(destTimer.current);
    if (text.trim().length < 2) { setDestSuggestions([]); return; }
    destTimer.current = setTimeout(async () => {
      setDestLoading(true);
      const results = await geocodeAutocomplete(text);
      setDestLoading(false);
      setDestSuggestions(results);
    }, 350);
  }

  function selectSource(s: Suggestion) {
    setSourceText(s.formatted);
    setSourceCoords({ latitude: s.lat, longitude: s.lon });
    setSourceSuggestions([]);
    setShowSourceDropdown(false);
    Keyboard.dismiss();
    saveRecentSearch(s.formatted, [s.lon, s.lat]);
  }

  function selectDest(s: Suggestion) {
    setDestText(s.formatted);
    setDestCoords({ latitude: s.lat, longitude: s.lon });
    setDestSuggestions([]);
    setShowDestDropdown(false);
    Keyboard.dismiss();
    saveRecentSearch(s.formatted, [s.lon, s.lat]);
  }

  function useGpsAsSource() {
    if (gpsCoords === null) return;
    setSourceText('Your Location');
    setSourceCoords(gpsCoords);
    setSourceSuggestions([]);
    setShowSourceDropdown(false);
    Keyboard.dismiss();
  }

  function useGpsAsDest() {
    if (gpsCoords === null) return;
    setDestText('Your Location');
    setDestCoords(gpsCoords);
    setDestSuggestions([]);
    setShowDestDropdown(false);
    Keyboard.dismiss();
  }

  async function saveRecentSearch(name: string, coordinates: [number, number]) {
    const token = await getAuthToken();
    if (!token) return;
    fetch(`${API_URL}/users/me/recent-searches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, coordinates }),
    }).then((res) => {
      if (res.ok) {
        setRecentSearches((prev) => {
          const filtered = prev.filter((r) => r.name !== name);
          return [{ name, coordinates }, ...filtered].slice(0, 5);
        });
      }
    }).catch(() => { });
  }

  function handleSwap() {
    const tmpText = sourceText;
    const tmpCoords = sourceCoords;
    setSourceText(destText);
    setSourceCoords(destCoords);
    setDestText(tmpText);
    setDestCoords(tmpCoords);
    setSourceSuggestions([]);
    setDestSuggestions([]);
    setShowSourceDropdown(false);
    setShowDestDropdown(false);
    setRoutePoints([]);
    setDistanceKm(null);
  }

  function handleOpenSettings() {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }

  const inputBg = colorScheme === 'dark' ? 'rgba(30,30,30,0.96)' : 'rgba(255,255,255,0.97)';
  const inputBorder = colorScheme === 'dark' ? '#444' : '#ddd';
  const cardBg = colorScheme === 'dark' ? 'rgba(26,26,26,0.97)' : 'rgba(255,255,255,0.97)';
  const tileUrl = colorScheme === 'dark' ? TILE_URL_DARK : TILE_URL_LIGHT;
  const suggBg = colorScheme === 'dark' ? '#1e1e1e' : '#ffffff';
  const suggBorder = colorScheme === 'dark' ? '#333' : '#e0e0e0';
  const suggDivider = colorScheme === 'dark' ? '#2a2a2a' : '#f0f0f0';

  // Show dropdown as soon as the field is focused (Your Location always available)
  // API suggestions appear once text >= 2 chars
  const showSourceSugg = showSourceDropdown;
  const showDestSugg = showDestDropdown;

  if (permission === 'checking') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.statusText, { color: colors.icon }]}>Requesting location…</Text>
      </View>
    );
  }

  if (permission === 'denied') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.deniedTitle, { color: colors.text }]}>Location Access Required</Text>
        <Text style={[styles.deniedSub, { color: colors.icon }]}>
          PathSharer needs your precise location to share your path.
        </Text>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: colors.tint }]}
          onPress={handleOpenSettings}
          activeOpacity={0.85}>
          <Text style={styles.locationButtonText}>Turn on Location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.retryButton} onPress={requestLocation}>
          <Text style={[styles.retryText, { color: colors.tint }]}>
            I already enabled it — retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Full-screen Geoapify map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={
          gpsCoords
            ? { ...gpsCoords, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : DEFAULT_REGION
        }
        showsUserLocation
        showsMyLocationButton={false}
        mapType="none">
        <UrlTile urlTemplate={tileUrl} maximumZ={19} flipY={false} tileSize={256} />
        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints}
            strokeColor={colors.tint}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Overlay */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Route input card */}
        <View style={[styles.routeCard, { backgroundColor: cardBg, shadowColor: colors.text }]}>
          {/* Swap button — absolutely positioned on the right, vertically centred */}
          <TouchableOpacity
            style={[styles.swapBtn, { backgroundColor: colors.tint }]}
            onPress={handleSwap}
            activeOpacity={0.75}>
            <Text style={styles.swapIcon}>⇅</Text>
          </TouchableOpacity>

          {/* Source row */}
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
            <TextInput
              style={[
                styles.routeInput,
                {
                  backgroundColor: inputBg,
                  borderColor: showSourceDropdown ? colors.tint : inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="From where?"
              placeholderTextColor={colors.icon}
              value={sourceText}
              onChangeText={handleSourceChange}
              onFocus={() => { setShowSourceDropdown(true); setShowDestDropdown(false); }}
              onBlur={() => { setTimeout(() => setShowSourceDropdown(false), 200); }}
              returnKeyType="next"
            />
            {sourceLoading && (
              <ActivityIndicator size="small" color={colors.tint} style={styles.rowSpinner} />
            )}
          </View>

          {/* Connector line */}
          <View style={styles.connectorRow}>
            <View style={[styles.connector, { backgroundColor: inputBorder }]} />
          </View>

          {/* Destination row */}
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: '#F44336' }]} />
            <TextInput
              style={[
                styles.routeInput,
                {
                  backgroundColor: inputBg,
                  borderColor: showDestDropdown ? colors.tint : inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Destination"
              placeholderTextColor={colors.icon}
              value={destText}
              onChangeText={handleDestChange}
              onFocus={() => { setShowDestDropdown(true); setShowSourceDropdown(false); }}
              onBlur={() => { setTimeout(() => setShowDestDropdown(false), 200); }}
              returnKeyType="search"
            />
            {destLoading && (
              <ActivityIndicator size="small" color={colors.tint} style={styles.rowSpinner} />
            )}
          </View>
        </View>

        {/* Female-only toggle — only shown for female users */}
        {userGender === 'female' && (
          <View style={[styles.femaleToggleCard, { backgroundColor: cardBg, shadowColor: colors.text }]}>
            <View style={styles.femaleToggleRow}>
              <Text style={[styles.femaleToggleText, { color: colors.text }]}>
                Connect with only female passengers
              </Text>
              <Switch
                value={femaleOnly}
                onValueChange={setFemaleOnly}
                trackColor={{ false: inputBorder, true: '#ff69b4' }}
                thumbColor={femaleOnly ? '#fff' : '#fff'}
              />
            </View>
          </View>
        )}

        {/* Source suggestions dropdown */}
        {showSourceSugg && (
          <View style={[styles.suggBox, { backgroundColor: suggBg, borderColor: suggBorder }]}>
            {/* Your Location — always first */}
            <TouchableOpacity
              style={styles.suggItem}
              onPress={useGpsAsSource}
              activeOpacity={0.7}>
              <View style={styles.suggRow}>
                <View style={[styles.suggDot, { backgroundColor: '#4CAF50' }]} />
                <View style={styles.suggTextWrap}>
                  <Text style={[styles.suggText, { color: colors.text }]}>Your Location</Text>
                  {gpsCoords !== null && (
                    <Text style={[styles.suggSub, { color: colors.icon }]}>
                      {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            {/* Recent searches — shown when text is empty */}
            {sourceText.trim().length < 2 && recentSearches.length > 0 && (
              <>
                <View style={[styles.suggSectionHeader, { borderTopColor: suggDivider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.suggSectionLabel, { color: colors.icon }]}>Recent</Text>
                </View>
                {recentSearches.map((r, i) => (
                  <TouchableOpacity
                    key={`recent-src-${i}`}
                    style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}
                    onPress={() => selectSource({ place_id: `recent-${i}`, formatted: r.name, lat: r.coordinates[1], lon: r.coordinates[0] })}
                    activeOpacity={0.7}>
                    <View style={styles.suggRow}>
                      <Text style={[styles.suggHistIcon, { color: colors.icon }]}>🕐</Text>
                      <Text style={[styles.suggText, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {/* API suggestions */}
            {sourceLoading && sourceSuggestions.length === 0 && (
              <View style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            )}
            {sourceSuggestions.map((s, i) => (
              <TouchableOpacity
                key={s.place_id}
                style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}
                onPress={() => selectSource(s)}
                activeOpacity={0.7}>
                <Text style={[styles.suggText, { color: colors.text }]} numberOfLines={2}>
                  {s.formatted}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Destination suggestions dropdown */}
        {showDestSugg && (
          <View style={[styles.suggBox, { backgroundColor: suggBg, borderColor: suggBorder }]}>
            {/* Your Location — always first */}
            <TouchableOpacity
              style={styles.suggItem}
              onPress={useGpsAsDest}
              activeOpacity={0.7}>
              <View style={styles.suggRow}>
                <View style={[styles.suggDot, { backgroundColor: '#4CAF50' }]} />
                <View style={styles.suggTextWrap}>
                  <Text style={[styles.suggText, { color: colors.text }]}>Your Location</Text>
                  {gpsCoords !== null && (
                    <Text style={[styles.suggSub, { color: colors.icon }]}>
                      {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            {/* Recent searches — shown when text is empty */}
            {destText.trim().length < 2 && recentSearches.length > 0 && (
              <>
                <View style={[styles.suggSectionHeader, { borderTopColor: suggDivider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.suggSectionLabel, { color: colors.icon }]}>Recent</Text>
                </View>
                {recentSearches.map((r, i) => (
                  <TouchableOpacity
                    key={`recent-dst-${i}`}
                    style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}
                    onPress={() => selectDest({ place_id: `recent-${i}`, formatted: r.name, lat: r.coordinates[1], lon: r.coordinates[0] })}
                    activeOpacity={0.7}>
                    <View style={styles.suggRow}>
                      <Text style={[styles.suggHistIcon, { color: colors.icon }]}>🕐</Text>
                      <Text style={[styles.suggText, { color: colors.text }]} numberOfLines={1}>{r.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {/* API suggestions */}
            {destLoading && destSuggestions.length === 0 && (
              <View style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}>
                <ActivityIndicator size="small" color={colors.tint} />
              </View>
            )}
            {destSuggestions.map((s, i) => (
              <TouchableOpacity
                key={s.place_id}
                style={[styles.suggItem, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: suggDivider }]}
                onPress={() => selectDest(s)}
                activeOpacity={0.7}>
                <Text style={[styles.suggText, { color: colors.text }]} numberOfLines={2}>
                  {s.formatted}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Route info pill */}
        {(routeLoading || distanceKm !== null) && (
          <View style={[styles.routeInfoRow, { backgroundColor: cardBg }]}>
            {routeLoading ? (
              <>
                <ActivityIndicator size="small" color={colors.tint} />
                <Text style={[styles.routeInfoText, { color: colors.icon, marginLeft: 8 }]}>
                  Calculating route…
                </Text>
              </>
            ) : (
              <Text style={[styles.routeInfoText, { color: colors.text }]}>
                {'📍'} {distanceKm !== null ? distanceKm.toFixed(1) + ' km' : ''}
              </Text>
            )}
          </View>
        )}

        <View style={{ flex: 1 }} pointerEvents="none" />

        <TouchableOpacity
          style={[
            styles.searchButton,
            {
              backgroundColor: colors.tint,
              opacity: sourceCoords !== null && destCoords !== null ? 1 : 0.55,
            },
          ]}
          disabled={sourceCoords === null || destCoords === null || savingLocation}
          onPress={handleFindCoPassengers}
          activeOpacity={0.85}>
          <Text style={styles.searchButtonText}>Find Co-passengers</Text>
        </TouchableOpacity>

        {/* Saving location overlay */}
        {savingLocation && (
          <View style={styles.savingOverlay}>
            <View style={[styles.savingCard, { backgroundColor: cardBg }]}>
              <ActivityIndicator size="large" color={colors.tint} />
              <Text style={[styles.savingText, { color: colors.text }]}>Saving location…</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    paddingTop: 52,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  statusText: { marginTop: 16, fontSize: 15 },
  deniedTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  deniedSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  locationButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginBottom: 16 },
  locationButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retryButton: { paddingVertical: 8 },
  retryText: { fontSize: 14 },
  routeCard: {
    borderRadius: 16,
    padding: 14,
    paddingRight: 50,
    marginBottom: 6,
    overflow: 'visible',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  routeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 15,
  },
  rowSpinner: { marginLeft: 4 },
  connectorRow: { paddingLeft: 5, paddingVertical: 3 },
  connector: { width: 2, height: 18, borderRadius: 1 },
  swapBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  swapIcon: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  suggBox: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  suggItem: { paddingHorizontal: 14, paddingVertical: 12 },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggDot: { width: 10, height: 10, borderRadius: 5 },
  suggTextWrap: { flex: 1 },
  suggText: { fontSize: 14, lineHeight: 20 },
  suggSub: { fontSize: 11, marginTop: 1 },
  suggSectionHeader: { paddingHorizontal: 14, paddingVertical: 6 },
  suggSectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggHistIcon: { fontSize: 13, width: 20 },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  routeInfoText: { fontSize: 14, fontWeight: '600' },
  searchButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  savingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  savingText: { fontSize: 16, fontWeight: '600' },
  femaleToggleCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 6,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  femaleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  femaleToggleText: { fontSize: 14, fontWeight: '500', flex: 1 },
});

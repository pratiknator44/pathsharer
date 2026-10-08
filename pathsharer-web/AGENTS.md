# AGENTS.md — PathSharer Web (`pathsharer-web`)

> Quick-reference for AI agents working on this codebase.  
> Live URL: **https://pathsharer.com**

---

## 1. What This App Is

PathSharer is a **real-time co-passenger discovery platform** focused on airport transfers.  
Users set a source → destination, are registered as "active", and see other active users on the same route. They can send ride-connect requests, chat, and coordinate a shared cab — all **without accounts or login** (guest sessions only).

- No authentication required from the user's perspective.
- No persistent user data (regular wipes; MVP philosophy).
- Entirely free — no in-app purchases.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript (Create React App) |
| Routing | React Router DOM v7 |
| Maps | Leaflet + react-leaflet v5 |
| Geocoding / Routing | Geoapify REST API |
| Real-time | Socket.IO client v4 |
| Styling | Vanilla CSS (`App.css`, `index.css`) |
| Build | `react-scripts` (CRA) |
| Backend | Separate Node.js service (see `../backend`) |

---

## 3. Directory Map

```
pathsharer-web/
├── public/
│   ├── index.html          # HTML shell; sets <title>, meta tags
│   ├── manifest.json       # PWA manifest (name, icons, theme_color)
│   ├── robots.txt          # Crawler policy
│   ├── logo192.png         # App icon (also used in push notifications)
│   ├── logo512.png         # Large app icon
│   └── music/
│       ├── ring.mp3        # Played when a ride-connect request arrives
│       └── ping.mp3        # Played when a chat message arrives
├── src/
│   ├── index.tsx           # React DOM entry point
│   ├── App.tsx             # Root component: providers + router + shell + overlays
│   ├── App.css             # All component CSS (single-file design system)
│   ├── index.css           # Body/global resets
│   ├── api.ts              # Fetch wrapper, token/user localStorage helpers, GuestUser type
│   ├── AuthContext.tsx     # AuthProvider: calls POST /auth/web-guest on mount
│   ├── SocketContext.tsx   # SocketProvider: Socket.IO connection + SOCKET_EVENTS enum
│   ├── currentSearchStore.ts  # localStorage store for the active search state
│   ├── notificationService.ts # Browser Notification API + Audio helpers
│   ├── pages/
│   │   ├── SharerPage.tsx       # "/" — map + route picker + Find Co-passengers
│   │   ├── CopassengersPage.tsx # "/copassengers" — list of nearby active users
│   │   ├── InboxPage.tsx        # "/inbox" — conversation list
│   │   ├── ChatPage.tsx         # "/chat/:userId" — real-time 1-on-1 chat
│   │   └── About.tsx            # "/about" — app info + Clear Local Data
│   └── components/
│       └── AirportReminderOverlay.tsx # One-time notification prompt for airport reminder
├── .env.example            # All supported env vars with defaults
├── tsconfig.json
└── package.json
```

---

## 4. Application Routes

| Path | Component | Description |
|---|---|---|
| `/` | `SharerPage` | Map + source/destination inputs + "Find Co-passengers" CTA |
| `/copassengers` | `CopassengersPage` | List of nearby active users; send ride-connect; auto-polls every 10 s |
| `/inbox` | `InboxPage` | Conversation list; unread badge in bottom nav |
| `/chat/:userId` | `ChatPage` | Real-time chat; hides bottom nav |
| `/about` | `About` | Info page; "Clear Local Data" wipes localStorage |

---

## 5. Global App Shell (`App.tsx`)

| Component | What it does |
|---|---|
| `AuthProvider` | Auto-calls `POST /auth/web-guest`; exposes `{ user, loading, error, refresh }` |
| `SocketProvider` | Opens Socket.IO on auth; exposes socket, online users, unread count, sendRideConnectRequest |
| `BottomNav` | 3-tab nav (About / Sharer / Messages); hidden inside `/chat/*` |
| `WelcomeOverlay` | Shown once on first visit at `/`; dismissed via `pathsharer_welcome_dismissed` in localStorage |
| `GlobalOverlay` | Full-screen overlay when an incoming ride-connect request arrives; plays ring.mp3 + browser notification |

---

## 6. State Management

PathSharer uses **no external state library**. State flows through:

1. **React Context** — `AuthContext` and `SocketContext`
2. **Component-local `useState`** — all page-level state
3. **`currentSearchStore.ts`** — thin localStorage wrapper for the active search (survives navigation between `/` and `/copassengers`)

### localStorage Keys

| Key | Purpose |
|---|---|
| `pathsharer_token` | JWT for the guest session |
| `pathsharer_user` | Serialized `GuestUser` object |
| `pathsharer_welcome_dismissed` | `"true"` once welcome overlay is dismissed |
| `pathsharer_current_search` | Active search state (users, source, dest coords) |
| `pathsharer_accepted_copassengers` | Map of `userId → name` for accepted connections |
| `pathsharer_airport_reminder_choice` | `"accepted"` or `"declined"` for airport reminder prompt |
| `locationPermission` | `"granted"` or `"denied"` for GPS |

---

## 7. API Integration

### Base URL resolution (`api.ts → getApiBaseUrl`)

- Reads `REACT_APP_API_URL` from env.
- Falls back to `/api/v1` (same-origin proxy, used in production behind Nginx).

### Guest Auth flow

```
App mounts → AuthProvider → webGuestLogin()
  → if (cached token + user in localStorage) → return cached
  → else → POST /api/v1/auth/web-guest
           ← { data: GuestUser, token: string }
           → store token + user → expose via context
```

### REST Endpoints used by the web app

| Method | Path | Used in | Purpose |
|---|---|---|---|
| `POST` | `/auth/web-guest` | `api.ts` | Auto-create guest session |
| `GET` | `/users/me/recent-searches` | `SharerPage` | Load recent searches for dropdown |
| `POST` | `/users/me/recent-searches` | `SharerPage` | Save a selected location |
| `POST` | `/active-users` | `SharerPage` | Register self as active with source + dest |
| `GET` | `/active-users/nearby` | `SharerPage`, `CopassengersPage` | Fetch nearby active users |
| `DELETE` | `/active-users/me` | `CopassengersPage` | Deregister self from active search |
| `GET` | `/messages/conversations` | `InboxPage` | List all conversations |
| `GET` | `/messages/:userId` | `ChatPage` | Load message history |
| `POST` | `/messages/:userId` | `ChatPage` | Send a text/image message |

---

## 8. Socket.IO Events (`SocketContext.tsx`)

### Emitted by client

| Event constant | Wire name | Payload | Trigger |
|---|---|---|---|
| `RIDE_CONNECT_REQUEST` | `ride:connect_request` | `{ toUserId, toDestination, requestId }` | User taps "Connect" on a co-passenger |
| `RIDE_CONNECT_RESPONSE` | `ride:connect_response` | `{ toUserId, decision, requestId }` | User accepts/declines incoming request |
| `CHAT_SEND_MESSAGE` | `chat:send_message` | `{ toUserId, content, type }` | User sends a chat message |
| `CHAT_READ` | `chat:read` | `{ fromUserId }` | User opens a chat conversation |

### Received by client

| Event constant | Wire name | Effect |
|---|---|---|
| `CHAT_MESSAGE` | `chat:message` | Adds to chat; increments unread badge; plays ping.mp3 |
| `CHAT_TYPING` | `chat:typing` | Shows typing indicator in ChatPage |
| `RIDE_CONNECT_INCOMING` | `ride:connect_request_incoming` | Shows GlobalOverlay; plays ring.mp3; fires browser notification |
| `RIDE_CONNECT_RESPONSE_RESULT` | `ride:connect_response_result` | Updates connect button status in CopassengersPage |
| _(plain)_ | `users:online` | Initial set of online user IDs |
| _(plain)_ | `user:online` | Add user to online set |
| _(plain)_ | `user:offline` | Remove user from online set |

---

## 9. Third-party Services

| Service | Purpose | Config key |
|---|---|---|
| **Geoapify** | Geocode autocomplete + driving route | `REACT_APP_GEOAPIFY_KEY` |
| **Leaflet / OpenStreetMap** | Map tiles (via Geoapify osm-bright tile layer) | Same Geoapify key |
| **Web Notifications API** | Push-style ride-connect + airport reminder prompts | Browser permission |
| **Web Audio API** | ring.mp3 (incoming request) / ping.mp3 (new message) | Static files in `public/music/` |

---

## 10. Environment Variables

Defined in `.env` / `.env.production` / `.env.example`:

| Variable | Default | Notes |
|---|---|---|
| `REACT_APP_API_URL` | `/api/v1` | Backend base URL; strip trailing slashes |
| `REACT_APP_GEOAPIFY_KEY` | `d765840f...` | Geocoding + map tiles |
| `REACT_APP_SOURCE_SUGGESTION_RADIUS_KM` | `75` | Radius filter for source autocomplete |
| `REACT_APP_DEST_SUGGESTION_RADIUS_KM` | `250` | Radius filter for destination autocomplete |
| `EXPO_PUBLIC_API_URL` | `https://pathsharer.com/api/v1` | Used by Expo (mobile) app, not web |

---

## 11. Key Conventions & Gotchas

- **No user accounts.** Every session is a guest. `POST /auth/web-guest` is called automatically — never prompt the user to log in.
- **Single CSS file.** All styles live in `src/App.css`. No CSS modules, no Tailwind.
- **No Redux / Zustand.** Use React context or `currentSearchStore` for cross-route state.
- **Socket auth uses JWT.** The token stored in `pathsharer_token` is passed as `auth.token` to Socket.IO on connect.
- **Geoapify radius filtering is client-side.** If no results within radius, it falls back to unfiltered results.
- **CopassengersPage polls every 10 s** via `setInterval` to refresh the nearby-users list.
- **Bottom nav hides on `/chat/*`** — check `location.pathname.startsWith('/chat/')`.
- **`ChatPage` route param is the other user's ID** — `useParams<{ userId: string }>()`.
- **Data wipe.** The About page's "Clear Local Data" button calls `localStorage.clear()` — this logs the user out and resets all state.
- **TypeScript strict mode** is off (`tsconfig.json` uses CRA defaults). Types are generally present but not exhaustive.

---

## 12. Running Locally

```bash
cd pathsharer-web
cp .env.example .env
# Edit REACT_APP_API_URL to point to your local backend
npm install
npm start        # Dev server → http://localhost:3000
npm run build    # Production build → build/
```

---

## 13. Related Parts of the Monorepo

| Directory | What it is |
|---|---|
| `../backend` | Node.js + Express + Socket.IO API server |
| `../frontend` | Expo / React Native mobile app |
| `../pathsharer-web` | **This directory** — React web app |

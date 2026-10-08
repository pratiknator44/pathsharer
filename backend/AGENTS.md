# AGENTS.md — PathSharer Backend (`backend`)

> Quick-reference for AI agents working on this codebase.  
> Related: [`../pathsharer-web/AGENTS.md`](../pathsharer-web/AGENTS.md) · [`../frontend/AGENTS.md`](../frontend/AGENTS.md)

---

## 1. What This Service Is

Node.js + Express REST API and Socket.IO real-time server for PathSharer.  
It handles guest authentication, active-user registration (with Redis TTL), co-passenger proximity search, 1-on-1 chat messaging, push notifications via Expo, and ride-connect request brokering over WebSocket.

- Default port: **5000**
- API prefix: **`/api/v1`**
- Health check: **`GET /health`**

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express v5 |
| Real-time | Socket.IO v4 |
| Primary DB | MongoDB via Mongoose v9 |
| Cache / Active users | Redis v5 |
| Auth | JWT (jsonwebtoken) |
| Push Notifications | Expo Server SDK |
| File uploads | Multer |
| Validation | Zod v4 |
| Security | Helmet + express-rate-limit |
| Dev server | ts-node-dev |

---

## 3. Directory Map

```
backend/
├── src/
│   ├── server.ts           # Entry point: connects DB + Redis, creates HTTP server, starts Socket.IO
│   ├── app.ts              # Express app: middleware stack, route mounting, error handler
│   ├── config/
│   │   └── env.ts          # Typed env config (PORT, MONGO_URI, JWT_SECRET, REDIS_URL, …)
│   ├── database/
│   │   ├── connection.ts   # Mongoose connect / disconnect / health check
│   │   └── redis.ts        # Redis client connect / disconnect / health check
│   ├── middlewares/
│   │   ├── auth.middleware.ts    # JWT verification; sets req.userId
│   │   ├── error.middleware.ts   # Central Express error handler (Zod, Mongo, generic)
│   │   └── logger.middleware.ts  # Request logger (METHOD path status ms)
│   ├── models/
│   │   ├── user.model.ts         # IUser — name, phone, gender, expoPushToken, recentSearches
│   │   ├── activeUser.model.ts   # IActiveUser — userId, source, destination, isActive, TTL indexes
│   │   ├── message.model.ts      # IMessage — sender, receiver, type (text|image), content, imageUrl, read
│   │   ├── journey.model.ts      # IJourney — full journey with participants, status, fare
│   │   ├── userJourney.model.ts  # IUserJourney — join table between User and Journey
│   │   └── notification.model.ts # INotification — userId, title, body, read
│   ├── routes/
│   │   ├── index.ts              # Mounts all sub-routers under /api/v1
│   │   ├── auth.routes.ts        # POST /auth/web-guest
│   │   ├── user.routes.ts        # CRUD + recent searches
│   │   ├── activeUser.routes.ts  # POST / GET nearby / DELETE
│   │   ├── message.routes.ts     # Conversations, history, image upload
│   │   ├── journey.routes.ts     # Journey lifecycle (open, matches, join, book, status)
│   │   ├── userJourney.routes.ts # UserJourney CRUD
│   │   ├── notification.routes.ts# CRUD + airport-location hook
│   │   └── config.routes.ts      # Public app metadata (contactEmail, playStoreUrl)
│   ├── controllers/
│   │   ├── auth.controller.ts              # webGuestLogin
│   │   ├── user.controller.ts              # createUser, getUser, updateUser, recentSearches
│   │   ├── activeUser.controller.ts        # upsertActiveUser, getNearbyUsers, deleteActiveUser
│   │   ├── message.controller.ts           # getConversations, getConversation, uploadImage, deleteImage
│   │   ├── journey.controller.ts           # full journey lifecycle
│   │   ├── userJourney.controller.ts       # userJourney CRUD
│   │   ├── notification.controller.ts      # getNotifications, markRead, delete
│   │   └── airport-location.controller.ts  # notifyAtAirport — Expo push for airport reminders
│   ├── services/
│   │   ├── auth.service.ts              # generateJWT helper
│   │   ├── findCoPassenger.service.ts   # findUsersByCoords — Redis-first, Mongo fallback
│   │   ├── matching.service.ts          # Route-overlap matching algorithm
│   │   ├── booking.service.ts           # Booking + fare logic
│   │   ├── pricing.service.ts           # Per-km fare calculation
│   │   └── push-notification.service.ts # sendRingNotification via Expo SDK
│   ├── sockets/
│   │   ├── index.ts               # initSocketIO, JWT auth middleware, room join, handler wiring
│   │   ├── events.ts              # SOCKET_EVENTS enum + all payload TypeScript interfaces
│   │   ├── chat.socket.ts         # send_message, typing, read-receipts, online tracking
│   │   ├── ride.socket.ts         # connect_request, connect_response
│   │   ├── journey.socket.ts      # journey room join/leave + journey events
│   │   └── notification.socket.ts # notification:new, notification:ring
│   ├── utils/
│   │   ├── upload.ts              # Multer config (disk, image filter, 5 MB limit)
│   │   └── name-generator.ts      # Random animal+adjective names for guest users
│   └── validators/
│       └── activeUser.validator.ts # Zod schema for POST /active-users body
├── uploads/                        # Uploaded message images (served at /uploads/*)
├── .env.example                    # All required env vars
├── tsconfig.json
└── package.json
```

---

## 4. Startup Sequence (`server.ts`)

```
main()
  ├── connectDB()         — fail fast if MONGO_URI bad
  ├── connectRedis()      — soft fail (warns but continues)
  ├── createServer(app)
  ├── initSocketIO(httpServer)
  └── httpServer.listen(PORT)
```

Graceful shutdown handles `SIGTERM` and `SIGINT`.

---

## 5. Middleware Stack (`app.ts`)

Applied in order:

| Middleware | Purpose |
|---|---|
| `helmet()` | Sets secure HTTP headers |
| `cors()` | Allows `*` in dev; locked in production |
| `rateLimit()` | Default: 100 req / 60 s per IP |
| `express.json({ limit: "100kb" })` | Body parsing |
| `express.static("/uploads")` | Serves uploaded message images |
| `requestLogger` | Logs `METHOD path status Xms` |
| `GET /health` | Returns `{ status, db, redis }` |
| `router` (all `/api/v1` routes) | Business logic |
| `errorHandler` | Catches Zod, Mongo, and generic errors |

---

## 6. REST API Reference

All routes are prefixed with `/api/v1`.  
Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/web-guest` | ❌ | Create/reuse a guest user; returns `{ data: GuestUser, token }` |

**Guest login logic:**  
Scans existing placeholder phones (`000000000N`), finds max N, creates `userN` / `000000000(N+1)`. JWT TTL is 1000 days for the web MVP.

---

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/users` | ❌ | Create a real user |
| `GET` | `/users/by-phone` | ❌ | Look up user by phone number |
| `GET` | `/users/me/recent-searches` | ✅ | Get up to 5 recent searches |
| `POST` | `/users/me/recent-searches` | ✅ | Append a recent search (name + coordinates) |
| `DELETE` | `/users/me` | ✅ | Delete own account |
| `GET` | `/users/:id` | ❌ | Get user by ID |
| `PATCH` | `/users/:id` | ❌ | Update user fields |
| `POST` | `/users/journey-metadata` | ❌ | Update journey-related metadata |

---

### Active Users

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/active-users` | ✅ | Register self as searching (upsert); writes to Mongo + Redis (TTL 1 h) |
| `GET` | `/active-users/nearby` | ✅ | Find nearby users by `?srcLng=&srcLat=&dstLng=&dstLat=`; excludes self |
| `DELETE` | `/active-users/me` | ✅ | Deregister; sets `isActive=false` in Mongo + deletes Redis key |

**Redis key:** `active-user:{userId}` (TTL 1 hour)  
**Matching:** `findCoPassenger.service.ts` — reads all active Redis keys, falls back to Mongo.

---

### Messages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/messages/conversations` | ✅ | List all conversations (latest message + unread count per peer) |
| `GET` | `/messages/:otherUserId` | ✅ | Paginated history — `?before=<ISO>&limit=<n>` |
| `POST` | `/messages/upload-image` | ✅ | Multipart upload (`field: "image"`); returns `{ imageUrl }` |
| `DELETE` | `/messages/image` | ✅ | Delete an uploaded image file |

Chat messages are delivered in real-time via Socket.IO (`chat:message`); REST endpoints provide history only.

---

### Journeys _(future / unused in MVP web app)_

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/journeys/open` | ❌ | List open journeys |
| `POST` | `/journeys/matches` | ❌ | Find nearby journey matches |
| `POST` | `/journeys` | ❌ | Create a journey |
| `GET` | `/journeys/:id` | ❌ | Get journey by ID |
| `POST` | `/journeys/:id/join` | ❌ | Join a journey |
| `POST` | `/journeys/:id/book` | ❌ | Book a journey |
| `PATCH` | `/journeys/:id/status` | ❌ | Update journey status |

---

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/notifications/airport-location` | ❌ | Check if user is at an airport; `userId` is supplied in the request body |
| `GET` | `/notifications/web-push/key` | ❌ | Get the public VAPID key |
| `POST` | `/notifications/web-push/subscription` | ✅ | Save the authenticated user's web push subscription |
| `DELETE` | `/notifications/web-push/subscription` | ✅ | Delete the authenticated user's web push subscription |
| `GET` | `/notifications` | ✅ | Get notifications (paginated, `?before=<ISO>`) |
| `PATCH` | `/notifications/read-all` | ✅ | Mark all as read |
| `PATCH` | `/notifications/:id/read` | ✅ | Mark one as read |
| `DELETE` | `/notifications/:id` | ✅ | Delete a notification |

---

### Config _(public)_

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/config` | ❌ | Returns `{ contactEmail, whatsappNumber, playStoreUrl }` |

---

## 7. Socket.IO Reference

### Connection & Auth

```
Client connects to ws://<host> with:
  { auth: { token: "<JWT>" } }

Server middleware verifies JWT → sets socket.data.userId
Each socket is joined to personal room: "user:<userId>"
```

### Socket Rooms

| Room name | Members |
|---|---|
| `user:{userId}` | All sockets for that user (multi-device) |
| `journey:{journeyId}` | All participants of a journey |

### Events (`src/sockets/events.ts`)

#### Client → Server

| Event | Handler file | Payload | What happens |
|---|---|---|---|
| `chat:send_message` | `chat.socket.ts` | `{ toUserId, type, content?, imageUrl? }` | Saves `Message` to Mongo; emits `chat:message` to recipient + echo to sender |
| `chat:typing` | `chat.socket.ts` | `{ toUserId, isTyping }` | Relays `chat:typing` to recipient's room |
| `chat:read` | `chat.socket.ts` | `{ fromUserId }` | Bulk marks messages as read; emits `chat:message_read` to original sender |
| `ride:connect_request` | `ride.socket.ts` | `{ toUserId, toDestination, requestId }` | Looks up requester name; emits `ride:connect_request_incoming` to target; sends Expo push; auto-ignores if target offline |
| `ride:connect_response` | `ride.socket.ts` | `{ toUserId, decision, requestId }` | Relays `ride:connect_response_result` back to original requester |
| `journey:join_room` | `journey.socket.ts` | `{ journeyId }` | Joins socket to `journey:{journeyId}` room |
| `journey:leave_room` | `journey.socket.ts` | `{ journeyId }` | Leaves room |

#### Server → Client

| Event | Trigger | Payload |
|---|---|---|
| `chat:message` | New message sent | Populated `IMessage` object |
| `chat:message_read` | Read receipts processed | `{ byUserId, readAt }` |
| `chat:online_status` | User connects/disconnects | `{ userId, online }` |
| `ride:connect_request_incoming` | Incoming connect request | `{ fromUserId, fromName, toDestination, requestId }` |
| `ride:connect_response_result` | Responder accepted/denied | `{ fromUserId, decision, requestId }` |
| `notification:new` | New notification | Notification document |
| `notification:ring` | Ring alert | Push payload |
| `journey:created/updated/…` | Journey lifecycle events | Journey document |
| `error` | Validation / internal error | `{ message }` |

---

## 8. MongoDB Models

| Model | Collection | Key fields |
|---|---|---|
| `User` | `users` | `name`, `phone` (unique), `gender`, `expoPushToken`, `recentSearches[]` |
| `ActiveUser` | `activeusers` | `userId` (ref User, unique), `source`, `destination`, `isActive`, `timestamp` |
| `Message` | `messages` | `sender`, `receiver`, `type`, `content`, `imageUrl`, `read`, `readAt` |
| `Journey` | `journeys` | Participants, fare, status, source/destination |
| `UserJourney` | `userjourneys` | Join table between User and Journey |
| `Notification` | `notifications` | `userId`, `title`, `body`, `read` |

### Key Indexes

- `ActiveUser`: `{ isActive: 1, updatedAt: -1 }`, `{ timestamp: -1 }`
- `Message`: `{ sender: 1, receiver: 1, createdAt: -1 }`

---

## 9. Redis Usage

| Key pattern | TTL | Value |
|---|---|---|
| `active-user:{userId}` | 3600 s (1 h) | JSON: `{ userId, name, isActive, source, destination, updatedAt }` |

The `findCoPassenger.service.ts` scans all `active-user:*` keys in Redis first. If Redis is unavailable, it falls back to a MongoDB query on `ActiveUser`.

---

## 10. Environment Variables

| Variable | Default | Required | Notes |
|---|---|---|---|
| `PORT` | `5000` | ❌ | HTTP listen port |
| `NODE_ENV` | `development` | ❌ | Controls CORS and logging |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/pathsharer` | ✅ | MongoDB connection string |
| `JWT_SECRET` | `change_this_…` | ✅ | **Change in production!** |
| `RATE_LIMIT_WINDOW_MS` | `60000` | ❌ | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `100` | ❌ | Max requests per window |
| `REDIS_URL` | `redis://localhost:6379` | ❌ | Soft dependency |
| `CONTACT_EMAIL` | `pratik@example.com` | ❌ | Returned by `/config` |
| `WHATSAPP_NUMBER` | `+919369319401` | ❌ | Returned by `/config` |
| `PLAY_STORE_URL` | Play Store URL | ❌ | Returned by `/config` |

---

## 11. Auth Middleware (`auth.middleware.ts`)

```
Request header: Authorization: Bearer <token>
  → jwt.verify(token, JWT_SECRET)
  → sets req.userId (string)
  → 401 if missing or invalid
```

`req.userId` is available in all protected route handlers.

---

## 12. Key Conventions & Gotchas

- **Guest phone format:** `000000000N` (9 zeros + N). The regex `/^0{9}\d+$/` identifies all guest users. Do not change this pattern.
- **Redis is soft.** If Redis is down, the app stays up but active-user lookups fall back to MongoDB (slightly slower, but functional).
- **Active user TTL = 1 hour.** Users expire from Redis automatically. The web client polls every 10 s; no permanent storage of "searching" state.
- **Uploaded images** go to `../uploads/` (relative to `dist/`) and are served at `/uploads/*`. Path stored as URL in `Message.imageUrl`.
- **Random guest names** are generated by `utils/name-generator.ts` (adjective + animal) on each `POST /active-users` — they change every time the user re-searches.
- **CORS in production** is set to `false` (same-origin only via Nginx proxy). In dev, `*` is allowed.
- **Socket rooms** use `user:{userId}` for personal delivery. Always emit to rooms, never to socket IDs directly.
- **Zod validation** is used for request bodies where it matters (e.g., `activeUser.validator.ts`). `errorHandler` catches `ZodError` and returns 400 with field details.
- **No TypeScript strict mode** — CRA/backend both use relaxed tsconfig defaults.

---

## 13. Running Locally

```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET
npm install
npm run dev    # ts-node-dev with --respawn --transpile-only

# Production
npm run build  # tsc → dist/
npm start      # node dist/server.js
```

---

## 14. Related Parts of the Monorepo

| Directory | What it is |
|---|---|
| `../pathsharer-web` | React web app (primary consumer of this API) |
| `../frontend` | Expo / React Native mobile app |
| `../backend` | **This directory** |

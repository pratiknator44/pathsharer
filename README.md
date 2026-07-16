<div align="center">

# 🚗 PathSharer

### Don't just share the road. Share the journey.

<img src="https://img.shields.io/badge/Msuccess
://img.shields.io/badge/React-Native-blue" />
<img src="https://img.shields..io/badge/MongoDB-Database-brightgreen" />
.shields.io/badge/Socket.IO-Realtime-black" />

</div>

---

## 🌍 The Problem

Every day, thousands of people travel the same routes.

Same destination.

Same timing.

Same traffic.

Same fuel costs.

Yet they travel alone.

PathSharer exists to change that.

---

## ✨ The Idea

Imagine opening an app and discovering:

> "Hey, someone else is going from Pune to Hinjawadi at 8 AM."

Or:

> "There are 3 people travelling your route tomorrow."

Instead of driving separately...

You connect.

You travel together.

You save money.

You reduce traffic.

You make the journey a little less lonely.

That's PathSharer.

---

## 🎬 What Is PathSharer?

PathSharer is a real-time co-passenger discovery platform that helps travelers find people moving along similar routes.

Whether it's:

- 🏢 Daily office commuting
- 🎓 College travel
- ✈️ Airport transfers
- 🚘 Long-distance road trips
- 🎉 Event travel

PathSharer helps people connect before the journey begins.

---

## ⚡ Core Features

### 🔐 Secure Authentication

Create an account and securely access the platform.

### 📍 Ride Discovery

Find people travelling where you're going.

### 👥 Potential Co-Passenger Matching

Discover nearby travelers with similar routes.

### 💬 Real-Time Chat

Communicate instantly before and during your trip.

### 🔔 Push Notifications

Stay informed about new matches and messages.

### 📱 Mobile First

Built using React Native + Expo for seamless mobile experiences.

### 🌐 Web Access

Access PathSharer from your browser anytime.

### ⚡ Live Updates

Powered by Socket.IO for real-time communication.

---

## 🏗️ Architecture

```text
                    ┌────────────────────┐
                    │    Mobile App      │
                    │ React Native Expo  │
                    └─────────┬──────────┘
                              │
                              │
                    REST API + WebSockets
                              │
                              ▼

                    ┌────────────────────┐
                    │     Backend API    │
                    │ Express + TS       │
                    └───────┬────────────┘
                            │
          ┌─────────────────┼───────────────────┐
          │                 │                   │
          ▼                 ▼                   ▼

     MongoDB           Redis Cache       Socket.IO

          │
          ▼

  Expo Push Notifications

          ▲
          │

  ┌────────────────────┐
  │     Web Client     │
  │   React + TS       │
  └────────────────────┘
```

---

## 🛠 Tech Stack

### Backend

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- Redis
- Socket.IO
- JWT
- Zod
- Multer

### Mobile

- React Native
- Expo
- TypeScript

### Web

- React
- TypeScript

---

## 📁 Monorepo Structure

```text
pathsharer/

├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── services/
│   ├── sockets/
│   └── validators/

├── frontend/
│   └── Expo Mobile Application

├── pathsharer-web/
│   └── React Web Application

└── README.md
```

---

## 🚀 Running Locally

### Backend

```bash
cd backend
npm install
npm run dev
```

### Mobile

```bash
cd frontend
npm install
npx expo start
```

### Web

```bash
cd pathsharer-web
npm install
npm start
```

---

## 🔮 Vision

PathSharer is not a ride-booking app.

It is not a taxi platform.

It is not another transportation marketplace.

PathSharer is building a network of people whose journeys already overlap.

The long-term vision is simple:

> Every empty seat is a missed connection.

---

## 🗺 Roadmap

### ✅ MVP

- Authentication
- Ride requests
- Matching
- Real-time chat
- Notifications
- Mobile app
- Web app

### 🚧 Next

- User verification
- Ride ratings
- Profile improvements
- Better route intelligence

### 🌟 Future

- Smart route recommendations
- Corporate commuting
- Groups & communities
- Carbon footprint tracking
- Shared travel subscriptions

---

## 📊 Why It Matters

Every shared ride means:

✅ Less traffic

✅ Lower travel costs

✅ Reduced emissions

✅ New connections

✅ Better journeys

---

## ❤️ Built With Purpose

PathSharer started as an MVP.

Not to build another app.

But to answer a simple question:

> What if travelling together became the default?

---

<div align="center">

### 🚗 Share Seats. Save Costs. Meet People.

**PathSharer**

*Because the best journeys are shared.*

</div>

# Norby 🗺️

> **Find your crew. Stop scrolling. Start meeting.**

Norby is a hyper-local, privacy-first, real-time social discovery platform designed to cure digital isolation and Gen-Z loneliness. It connects people nearby for spontaneous, offline face-to-face meetups—whether it's getting a matcha latte, co-working, skating, or jamming out to alt records.

---

## ⚡ Key Features

* **Live Radar Map**: A real-time, responsive Leaflet map showcasing nearby active users (within 10km) and pulsing hotspot rooms.
* **Privacy-First Location Masking**: Toggleable masking that applies a session-stable ±150m randomized offset to your coordinates. Your neighborhood stays discoverable, but your exact address remains hidden.
* **Hotspot Intent Rooms**: Create public/private meetups with a custom vibe (e.g., *Guitar Jam Session 🎸*, *Study Grind 📚*). Tap nearby hotspots to request to join.
* **Real-time Approval & Chats**: Hosts receive instant popups to accept or decline incoming join requests. Approval unlocks a private group chat for coordinate planning.
* **Stable Geolocation Racing**: A dual-source geolocation algorithm that races IP-based queries against device GPS APIs, guaranteeing sub-200ms initial loads with zero map collapse.

---

## 🛠️ Tech Stack

* **Frontend**: Next.js (App Router, TS, Tailwind CSS, Leaflet)
* **Real-time Engine**: Standalone Node.js WebSocket Server
* **Authentication & Persistence**: Powered by Puter Auth & Puter Key-Value Storage
* **Scalability**: Redis Pub/Sub backend ready for horizontal multi-instance scaling

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/gitsofaryan/norby.git
cd norby
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# URL for the WebSocket connection (defaults to ws://localhost:3001 in dev)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### 3. Start the Development Server

Norby runs on two parallel servers (Next.js frontend + WebSocket coordinator). Spin both up concurrently:

```bash
npm run dev
```

* **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
* **WebSocket Server**: `http://localhost:3001`

---

## 🔒 Security & Privacy

Norby keeps your coordinates secure:
1. Coordinates are never logged or stored long-term in any central database; they reside solely in transient Redis cache states.
2. The location masking offset remains consistent per browser session, ensuring you move smoothly without jittering while keeping your precise location protected.

# 🚖 Distributed Real-Time Ride Sharing Backend Platform

A production-grade, event-driven ride-hailing backend engineered with TypeScript, Node.js, Uber H3 Spatial Indexing, Redis, and PostgreSQL.

---

## 🏗️ Architecture Highlights

- **Spatial Indexing via Uber H3**: Hexagonal hierarchical indexing ($Resolution\ 8$) for microsecond driver lookup and radius expansions ($k$-ring).
- **Multi-Threaded Pathfinding**: Custom Dijkstra shortest-path computation offloaded to background **Node.js Worker Threads** to prevent event loop starvation.
- **Concurrency Control & Mutex**:
  - Redis Distributed Mutex (`NX EX`) for driver assignment.
  - PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) within ACID transactions to eliminate double-booking edge cases.
- **Dynamic Demand-to-Supply Surge Pricing**: Live metric calculation on demand spikes ($D/S$ ratio) over sliding windows.
- **Real-Time Telemetry & Scalable WebSockets**: Socket.io backed by **Redis Pub/Sub Adapter** enabling horizontal multi-instance scaling.
- **Defense in Depth**: Token bucket/fixed window Redis API Rate Limiting, RBAC middleware, and HttpOnly Cookie-based JWT rotation.

---

## ⚡ Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Harshit2056/RIDE-SAHRING-PLATFORM

# 2. Enter repository
cd RIDE-SAHRING-PLATFORM

# 3. Enter backend
cd BACKEND

# 4. Create environment file
# Copy .env.example to .env and fill required values

# 5. Start the backend application
npm run dev

# 6. Start the frontend application (in a new terminal)
cd ../FRONTEND
npm install
npm run dev
```

---

## 💻 Frontend Client (Vite + React + Leaflet + Tailwind CSS)

The interactive dashboard provides:
- **Rider Interface**: Interactive Leaflet map with pickup/dropoff pinning, dynamic fare estimate, AI surge multiplier ($1.0\times - 2.5\times$), nearby driver radar, and live telemetry tracking.
- **Driver Interface**: Duty switch (Online/Offline), incoming ride assignment alerts with sound/animation, live GPS telemetry simulation, and FSM trip controls (`MATCHED` ➔ `IN_TRANSIT` ➔ `COMPLETED`).
- **1-Click Demo Accounts**: Instant test login for both Rider and Driver with zero configuration needed.


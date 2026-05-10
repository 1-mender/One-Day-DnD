# 🏗️ АРХИТЕКТУРНАЯ ДОКУМЕНТАЦИЯ D&D LAN

---

## 📊 Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER (React + Vite)               │
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │  DM Dashboard    │   │  Player Client   │                   │
│  │  • Party setup   │   │  • Inventory     │                   │
│  │  • Bestiary      │   │  • Profile       │                   │
│  │  • Arcade admin  │   │  • Mini-games    │                   │
│  │  • Events view   │   │  • Events log    │                   │
│  └────────┬─────────┘   └────────┬─────────┘                   │
│           │ React Context API    │                               │
│           │ React Router DOM     │                               │
│           └────────────┬─────────┘                               │
│                        │                                          │
│         Socket.IO Client (WebSocket)                             │
│         REST API (Fetch)                                         │
└────────────────────────┬──────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    WebSocket (binary protocol)    HTTP REST API
         │                               │
┌────────▼───────────────────────────────▼──────┐
│                                                │
│        EXPRESS SERVER (server/src)            │
│                                                │
│  ┌────────────────────────────────────────┐  │
│  │  Socket.IO Server                      │  │
│  │  • Presence management                 │  │
│  │  • Real-time sync                      │  │
│  │  • Grace-period (4 sec)                │  │
│  │  • Multi-tab awareness                 │  │
│  └────────────────────────────────────────┘  │
│                                                │
│  ┌────────────────────────────────────────┐  │
│  │  REST Routes (/api/*)                  │  │
│  │  • Auth: /api/auth/login, logout       │  │
│  │  • Inventory: /api/inventory/add, etc  │  │
│  │  • Bestiary: /api/bestiary/search      │  │
│  │  • Arcade: /api/arcade/play            │  │
│  │  • Backup: /api/backup/export, import  │  │
│  └────────────────────────────────────────┘  │
│                                                │
│  ┌────────────────────────────────────────┐  │
│  │  Middleware Stack                      │  │
│  │  • Helmet (security headers)           │  │
│  │  • CORS                                │  │
│  │  • Rate limiting                       │  │
│  │  • Body parser (JSON/multipart)        │  │
│  │  • Write Gate (degraded mode)          │  │
│  │  • Auth middleware (JWT + tokens)      │  │
│  └────────────────────────────────────────┘  │
│                                                │
│  ┌────────────────────────────────────────┐  │
│  │  Health & Monitoring                   │  │
│  │  • GET /healthz (liveness)             │  │
│  │  • GET /readyz (readiness)             │  │
│  │  • Runtime metrics                     │  │
│  │  • Structured logging (Pino)           │  │
│  └────────────────────────────────────────┘  │
│                                                │
└────────────┬─────────────────────────────────┘
             │
    ┌────────▼────────────┐
    │  SQLite Database    │
    │  better-sqlite3     │
    │                     │
    │  Tables:            │
    │  • parties (1 only) │
    │  • users (DM)       │
    │  • players          │
    │  • inventory_items  │
    │  • arcade_sessions  │
    │  • events_log       │
    │  • tickets          │
    │  • bestiary_entries │
    │  • info_blocks      │
    │  • join_requests    │
    └─────────────────────┘
             │
    ┌────────▼────────────┐
    │  Data Persistence   │
    │                     │
    │  • app.db           │
    │  • backups/*.db     │
    │  • uploads/         │
    └─────────────────────┘
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION FLOW

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. User opens http://localhost:3000/dm              │   │
│  │  2. Browser shows login form                         │   │
│  │  3. User enters username + password                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬──────────────────────────────────┘
                         │
                    POST /api/auth/login
                    + username, password
                         │
┌────────────────────────▼──────────────────────────────────┐
│                       SERVER                               │
│                                                            │
│  1. Validate input (Zod schema)                           │
│  2. Query: SELECT * FROM users WHERE username=?          │
│  3. Compare password with bcrypt hash                    │
│  4. ✅ Match:                                             │
│     - Generate JWT token:                                │
│       { uid, username, role: 'dm', token_version }       │
│     - Set-Cookie: dm_token = JWT                         │
│     - Return: { ok: true, redirect: '/dm' }              │
│  ❌ Mismatch:                                             │
│     - Return: 401 { error: "unauthorized" }              │
│                                                            │
└────────────────────────┬──────────────────────────────────┘
                         │
           Response: Set-Cookie header
           + JWT token in cookie
                         │
┌────────────────────────▼──────────────────────────────────┐
│                      CLIENT                                │
│  Browser автоматически сохраняет cookie                   │
│  На каждый следующий request → cookie отправляется       │
│                                                            │
│  Обращение к защищённому route:                           │
│  GET /api/inventory                                       │
│  + Cookie: dm_token=JWT                                   │
└────────────────────────┬──────────────────────────────────┘
                         │
┌────────────────────────▼──────────────────────────────────┐
│                      SERVER                                │
│                                                            │
│  dmAuthMiddleware проверяет:                              │
│  1. cookie.dm_token существует?                          │
│  2. jwt.verify(token, secret) валиден?                   │
│  3. SELECT users WHERE id = token.uid                    │
│  4. Проверить token_version = payload.tv?                │
│     (для revocation при смене пароля)                    │
│                                                            │
│  ✅ Все OK:                                               │
│     - req.dm = payload                                   │
│     - next() → обработчик маршрута                       │
│  ❌ Ошибка:                                               │
│     - return 401 { error: "not_authenticated" }          │
│                                                            │
└────────────────────────┬──────────────────────────────────┘
                         │
                    Response: Data или 401
```

### Player Authentication (по join коду)

```
Player получает join ссылку или QR код:
http://localhost:3000/join?code=ABC123

1. Browser открывает /join
2. Клиент отправляет: POST /api/auth/player/session?code=ABC123
3. Сервер:
   - Проверить join_code существует
   - Проверить не истёк ли (TTL)
   - Создать player token (random, store in DB)
   - Return: { playerToken }
4. Клиент сохраняет playerToken в localStorage
5. При socket.io connect:
   - auth: { role: 'player', playerToken }
6. Сервер на socket event:
   - Проверить playerToken
   - Установить socket.data.playerId
```

---

## 🔄 PRESENCE MANAGEMENT (NEW)

```
ПРОБЛЕМА: Multi-tab браузер
─────────────────────────────────────────────

Tab 1 (Inventory): socket connected as Player 5
Tab 2 (Profile):   socket connected as Player 5
───────────────────────────────────────────────
Если Tab 1 закроется → Player 5 goes offline?
Но Tab 2 всё ещё connected!

РЕШЕНИЕ: Grace Period + Счётчик
─────────────────────────────────────────────

┌─────────────────────────────────────────────┐
│ activeSocketsByPlayerId = Map<playerId, N>  │
│ offlineTimersByPlayerId = Map<playerId, T>  │
└─────────────────────────────────────────────┘

Event: Socket 1 connect as Player 5
─────────────────────────────────────────────
1. activeSocketsByPlayerId.get(5) = 0
2. count = 0 + 1 = 1
3. Set: activeSocketsByPlayerId.set(5, 1)
4. Cancel offline timer (if exists)
5. Status was offline, now online → EMIT player:statusChanged
6. Database UPDATE players SET status='online'

Event: Socket 1 disconnect
─────────────────────────────────────────────
1. activeSocketsByPlayerId.get(5) = 1
2. count = 1 - 1 = 0
3. Set: activeSocketsByPlayerId.set(5, 0)
4. Count is now 0 → START offline timer (GRACE_MS = 4000)
5. ⏱️ 4 seconds pass...
6. If NO new connect in 4 sec → EMIT offline event
7. Database UPDATE players SET status='offline'

Event: Socket 2 (Tab 2) connect as Player 5 (within grace period)
─────────────────────────────────────────────
1. Timer still running!
2. count = 0 + 1 = 1
3. CANCEL timer immediately
4. count was 0, now 1 → NO offline event sent
5. Status stays 'online' in database
6. ✅ No offline flicker!

GRACE PERIOD = 4000 ms (configurable)
```

---

## 💾 BACKUP & RECOVERY FLOW

```
┌──────────────────────────────────────────────────────────┐
│             AUTO-BACKUP (Background Job)                 │
│                                                           │
│  Every BACKUP_EVERY_MS (default 10 min):                 │
│                                                           │
│  1. Lock database (no writes during backup)              │
│  2. db.backup("backups/app-TIMESTAMP.db")                │
│  3. Release lock                                          │
│  4. Prune old backups (keep BACKUP_RETAIN = 20)          │
│  5. Log success                                          │
│                                                           │
│  Location: %LOCALAPPDATA%/dnd-lan/backups/               │
│  RPO: ≤ 10 minutes                                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│           MANUAL EXPORT (DM auth required)                │
│                                                           │
│  GET /api/backup/export                                  │
│                                                           │
│  Response: ZIP archive containing:                        │
│  ├─ app.db (database snapshot)                           │
│  └─ uploads/ (all uploaded files)                        │
│                                                           │
│  Use: Download to safe location, email to team           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│          MANUAL IMPORT (DM auth required)                 │
│                                                           │
│  POST /api/backup/import (multipart: zip file)           │
│                                                           │
│  Validation:                                              │
│  1. Check ZIP structure (contains app.db)                │
│  2. Extract to temp directory                            │
│  3. Validate single-party constraint                     │
│  4. If backup has 2+ parties → REJECT                    │
│  5. Swap DB file (atomic)                                │
│  6. Restore uploads/                                      │
│  7. Reinit database connection                           │
│                                                           │
│  Result: Database rolled back to backup point            │
└──────────────────────────────────────────────────────────┘

Disaster Recovery Timeline
─────────────────────────────

SCENARIO: Server crash at 14:05
Backups created at: 13:55, 14:00, 14:05 (crash)

Recovery steps:
1. Restart server
2. System checks /readyz
3. If corruption detected → import last backup
4. Restore from 14:00 backup → ≤ 5 min data loss
5. RPO target: ≤ 10 min ✅

RTO (Recovery Time Objective): 1-2 minutes
```

---

## 📊 WRITE GATE & DEGRADED MODE

```
┌──────────────────────────────────────────────────────────┐
│          Readiness Check (every 10 seconds)              │
│                                                           │
│  1. Database accessible?                                 │
│  2. Uploads directory writable?                          │
│  3. Disk space available?                                │
│  4. No "database is locked" error?                       │
│                                                           │
│  Result:                                                  │
│  ✅ All OK → READY state                                 │
│  ❌ Any fail → DEGRADED state                            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│          Write Gate Middleware                           │
│                                                           │
│  When DEGRADED state:                                    │
│                                                           │
│  GET /api/inventory  → ✅ 200 OK (READ allowed)         │
│  POST /api/inventory → ❌ 503 Service Unavailable        │
│                          + Retry-After: 60 sec           │
│                                                           │
│  Bypass list (always allowed):                           │
│  - POST /api/auth/login     (need to auth)              │
│  - POST /api/auth/logout    (need to logout)            │
│  - POST /api/auth/player/session                        │
│  - POST /api/backup/import  (restore data)              │
│                                                           │
│  This allows players to logout and read-only access     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│          Client Experience During Degradation           │
│                                                           │
│  1. Player clicks "Add Item" (POST)                      │
│  2. Server responds: 503 read_only                       │
│  3. Client shows: "Server temporarily unavailable"       │
│  4. Retry button (with exponential backoff)              │
│  5. Once /readyz returns OK → auto-retry                 │
│  6. If > 5 min degraded → suggest restart session        │
│                                                           │
│  Benefits:                                                │
│  - Session doesn't crash                                 │
│  - Player knows what happened                            │
│  - Can retry when fixed                                  │
│  - Data integrity maintained                             │
└──────────────────────────────────────────────────────────┘
```

---

## 🎮 ARCADE SYSTEM FLOW

```
┌─────────────────────────────────────────────────────────┐
│              Player opens Arcade (Fish section)          │
│                                                          │
│  1. GET /api/arcade/games                               │
│  2. Server returns list of mini-games with:             │
│     - name, description                                 │
│     - entryCost (tickets required)                      │
│     - rewardMin/Max                                     │
│     - dailyLimit (plays remaining today)                │
│     - playerStats (wins/losses)                         │
│  3. Client displays game cards                          │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│        Player clicks on a game (e.g., Match3)         │
│                                                        │
│  1. Check if enough tickets: GET /api/tickets/balance │
│  2. If balance < entryCost → show "not enough"       │
│  3. If OK → POST /api/arcade/play                    │
│     + gameId, difficulty (optional)                  │
│     + session_id (create if new)                     │
│  4. Server:                                           │
│     - Create arcade_session record                    │
│     - Deduct entryCost from player tickets            │
│     - Initialize game state (random board, etc)       │
│     - Return: session_id + initial_state             │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│        Game runs in browser (client-side)             │
│                                                        │
│  - All game logic local (no server sync needed)        │
│  - Player makes moves                                 │
│  - Browser detects game end (win/loss)               │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│      Player finishes game → Submit result              │
│                                                        │
│  POST /api/arcade/play/result                         │
│  + session_id, won (true/false), score               │
│                                                        │
│  Server:                                               │
│  1. Validate session exists & not already submitted   │
│  2. Verify won (with simple server-side check)        │
│  3. Calculate reward:                                 │
│     - Base: rewardMin + random(rewardMax - rewardMin) │
│     - Streak bonus: if consecutive wins              │
│     - Auto-balance adjustment: if enabled            │
│  4. Award tickets: UPDATE player SET tickets += reward│
│  5. Log event: UPDATE arcade_sessions SET won=...    │
│  6. Return: { ok, ticketsEarned, newBalance }        │
└──────────────────────┬────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────┐
│      Client updates UI                                │
│                                                        │
│  - Show reward notification                           │
│  - Update ticket balance                              │
│  - Return to arcade list                              │
│  - Can play again (if dailyLimit not reached)         │
└──────────────────────────────────────────────────────┘
```

---

## 📈 DATA CONSISTENCY & TRANSACTIONS

```
INVENTORY UPDATE Example
─────────────────────────

Normal case:
┌────────────────────────────────┐
│ BEGIN TRANSACTION              │
│ UPDATE inventory_items SET ... │
│ UPDATE players SET ...         │
│ COMMIT                         │
└────────────────────────────────┘
Result: ✅ Atomic

Crash during UPDATE:
┌────────────────────────────────┐
│ BEGIN TRANSACTION              │
│ UPDATE inventory_items ...     │
│ ❌ CRASH (power loss)          │
│ (never reaches COMMIT)         │
└────────────────────────────────┘
Result: ✅ Rollback on recovery (SQLite handles)

Better-sqlite3 features:
─────────────────────────────
- Synchronous (no callback hell)
- Auto-handle journal files
- WAL mode (Write-Ahead Logging) for concurrency
- Foreign keys enforced
```

---

## 🚨 ERROR HANDLING ARCHITECTURE

```
┌─────────────────────────────────────────────────────┐
│            Error happens in route handler            │
│                                                      │
│  POST /api/inventory/add                            │
│  try {                                               │
│    // Business logic                                │
│    const item = addItem(playerId, itemData);       │
│  } catch (e) {                                       │
│    if (e.code === "INVENTORY_FULL") {               │
│      return res.status(400).json({                  │
│        error: "inventory_full"                      │
│      });                                             │
│    }                                                 │
│    if (e.code === "ITEM_NOT_FOUND") {               │
│      return res.status(404).json({                  │
│        error: "item_not_found"                      │
│      });                                             │
│    }                                                 │
│    // Unknown error → log & return 500              │
│    logger.error({ err: e }, "add item failed");    │
│    return res.status(500).json({                    │
│      error: "internal_error"                        │
│    });                                               │
│  }                                                   │
└─────────────────────────────────────────────────────┘

Error responses pattern:
─────────────────────────
200 OK:       { ok: true, data: {...} }
400 Bad:      { error: "validation_failed", details }
401 Auth:     { error: "not_authenticated" }
403 Perm:     { error: "forbidden" }
404 NotFound: { error: "resource_not_found" }
409 Conflict: { error: "conflict", currentVersion }
503 Degraded: { error: "read_only", Retry-After }
500 Error:    { error: "internal_error" }
```

---

## 🔧 DEPLOYMENT ARCHITECTURE

```
Development:
─────────────
npm run dev
↓
Runs: server (port 3000) + client (Vite port 5173)
Client proxies API to server via Vite config

Production (Single Binary):
────────────────────────────
npm run build
↓
1. Vite builds client → client/dist/
2. Copy dist to server/public/
3. npm run start
↓
Express serves:
- Static files from /public (client)
- API routes (/api/*)
- Socket.IO (/socket.io)
↓
Single process, single port (3000)
```

---

**Last Updated:** 11 мая 2026 г.

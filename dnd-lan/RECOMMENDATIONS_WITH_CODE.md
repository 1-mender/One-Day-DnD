# 🔧 ДЕТАЛЬНЫЕ РЕКОМЕНДАЦИИ С ПРИМЕРАМИ КОДА

**Документ:** Конкретные fix'ы и улучшения для D&D LAN  
**Дата:** 11 мая 2026 г.

---

## 1. [SECURITY] CSRF Protection на REST API

### Проблема
REST POST/PUT/DELETE не имеют явной CSRF защиты. Socket.IO immune по определению, но HTTP routes уязвимы.

### Текущий код (server/src/bootstrap/app.js)
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      // ...
    }
  }
}));

// Нет CSRF middleware!
```

### Решение

**Вариант A: csrfProtection middleware (рекомендуется для LAN)**

```javascript
// server/src/bootstrap/app.js
import csrf from "csurf";

export function createApp() {
  const app = express();
  
  // ... существующий код ...
  
  // CSRF protection для form-encoded и JSON
  const csrfProtection = csrf({
    cookie: false,  // Используем session-based
    value: (req) => req.headers["x-csrf-token"] || req.body._csrf
  });
  
  // Применить ТОЛЬКО к mutating routes
  app.post("/api/*", csrfProtection, (req, res, next) => {
    // Middleware автоматически проверит token
    next();
  });
  app.put("/api/*", csrfProtection, (req, res, next) => next());
  app.delete("/api/*", csrfProtection, (req, res, next) => next());
  
  // GET routes генерируют token
  app.get("/api/csrf-token", csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });
  
  // ...rest of app
}
```

**Вариант B: Double-Submit Cookie (альтернатива)**

```javascript
// Для LAN можно использовать более простую схему
export function verifyCsrfToken(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  
  const token = req.headers["x-csrf-token"] || req.body._csrf;
  const cookieToken = req.cookies["csrf-token"];
  
  if (!token || token !== cookieToken) {
    return res.status(403).json({ error: "csrf_token_mismatch" });
  }
  next();
}

// На клиенте (src/api/index.js)
async function fetchWithCsrf(url, options = {}) {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  const headers = {
    ...options.headers,
    "X-CSRF-Token": token
  };
  return fetch(url, { ...options, headers });
}
```

### Установка зависимости
```bash
npm --prefix server install csurf express-session
```

### Тест
```javascript
// server/test/csrfProtection.test.js
import test from "node:test";
import assert from "node:assert";

test("POST без CSRF token должен быть отклонён", async (t) => {
  const res = await fetch("http://localhost:3000/api/inventory/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId: 1 }),
    credentials: "include"
  });
  assert.strictEqual(res.status, 403);
  assert.match(await res.text(), /csrf/);
});
```

**Приоритет:** P1  
**Estimated effort:** 3-4 часа (include tests)

---

## 2. [RELIABILITY] Inventory Race Condition Check

### Проблема
Если DM и Player одновременно обновляют инвентарь:
```
Player: "Переместить меч в слот 1"
DM:     "Удалить меч из инвентаря"
→ Race condition! Кто выиграет?
```

### Текущий код (где?)
```bash
# Нужно найти где обрабатывается inventory update
find server/src -name "*.js" | xargs grep -l "inventory_items.*UPDATE"
```

### Предлагаемое решение: Version/Timestamp на inventory_items

**Добавить колонку в schema:**
```sql
-- server/src/schema.sql
ALTER TABLE inventory_items ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE inventory_items ADD COLUMN updated_at TEXT;

CREATE INDEX idx_inventory_items_version ON inventory_items(version);
```

**Update с оптимистичной блокировкой:**
```javascript
// server/src/inventory/routes.js
export function updateInventoryItem(req, res) {
  const db = getDb();
  const { itemId, slotId, version } = req.body;
  const playerId = req.player.id;
  
  try {
    // Проверить version перед update
    const current = db.prepare(
      "SELECT version FROM inventory_items WHERE id=? AND player_id=?"
    ).get(itemId, playerId);
    
    if (!current) {
      return res.status(404).json({ error: "item_not_found" });
    }
    
    if (current.version !== version) {
      return res.status(409).json({
        error: "conflict",
        message: "Item was modified by another user. Please refresh.",
        currentVersion: current.version
      });
    }
    
    // Atomic update with version increment
    const result = db.prepare(`
      UPDATE inventory_items 
      SET slot_id=?, version=version+1, updated_at=?
      WHERE id=? AND player_id=? AND version=?
    `).run(slotId, now(), itemId, playerId, version);
    
    if (result.changes === 0) {
      return res.status(409).json({ error: "conflict" });
    }
    
    // Вернуть обновленный item
    const updated = db.prepare(
      "SELECT id, slot_id, version, updated_at FROM inventory_items WHERE id=?"
    ).get(itemId);
    
    res.json({ ok: true, item: updated });
  } catch (e) {
    logger.error({ err: e }, "inventory update failed");
    res.status(500).json({ error: "update_failed" });
  }
}
```

**Тест:**
```javascript
// server/test/inventoryRaceCondition.test.js
import test from "node:test";
import assert from "node:assert";

test("Concurrent inventory updates должны быть safely handled", async (t) => {
  const playerId = 1;
  const itemId = 100;
  
  // Прочитать текущую version
  const { version: v1 } = db.prepare(
    "SELECT version FROM inventory_items WHERE id=?"
  ).get(itemId);
  
  // Update 1 (успешный)
  const res1 = await updateInventoryItem({ itemId, slotId: 1, version: v1 });
  assert.strictEqual(res1.status, 200);
  
  // Update 2 (должен быть отклонен)
  const res2 = await updateInventoryItem({ itemId, slotId: 2, version: v1 });
  assert.strictEqual(res2.status, 409);
  assert.match(res2.body.error, /conflict/);
});
```

**Приоритет:** P0  
**Estimated effort:** 4-6 часов (migrations, tests)

---

## 3. [OPS] Prometheus Metrics Endpoint

### Проблема
Нет standard metrics format для мониторинга. Prometheus/Grafana требуют expose-metrics на `/metrics`.

### Решение: /metrics endpoint

**server/src/prometheus.js (новый файл)**
```javascript
export class PrometheusMetrics {
  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  counter(name, help = "") {
    if (!this.counters.has(name)) {
      this.counters.set(name, { value: 0, help });
    }
    return {
      inc: (delta = 1) => {
        const c = this.counters.get(name);
        c.value += delta;
      }
    };
  }

  gauge(name, help = "") {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { value: 0, help });
    }
    return {
      set: (value) => this.gauges.get(name).value = value,
      inc: (delta = 1) => this.gauges.get(name).value += delta
    };
  }

  format() {
    let output = "";
    
    // Counters
    for (const [name, { help, value }] of this.counters) {
      output += `# HELP ${name} ${help}\n`;
      output += `# TYPE ${name} counter\n`;
      output += `${name}_total ${value}\n\n`;
    }
    
    // Gauges
    for (const [name, { help, value }] of this.gauges) {
      output += `# HELP ${name} ${help}\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n\n`;
    }
    
    return output;
  }
}

export const metrics = new PrometheusMetrics();

// Предопределённые метрики
export const socketConnectedCounter = metrics.counter(
  "socket_connected",
  "Total socket connections"
);
export const socketDisconnectedCounter = metrics.counter(
  "socket_disconnected",
  "Total socket disconnections"
);
export const activePlayersGauge = metrics.gauge(
  "active_players",
  "Current number of online players"
);
export const inventoryWriteCounter = metrics.counter(
  "inventory_writes",
  "Total inventory write operations"
);
export const backupLastDurationMs = metrics.gauge(
  "backup_last_duration_ms",
  "Last backup duration in milliseconds"
);
```

**server/src/bootstrap/app.js (добавить)**
```javascript
import { metrics } from "../prometheus.js";

export function createApp() {
  const app = express();
  
  // ...существующий код...
  
  // Prometheus endpoint
  app.get("/metrics", (req, res) => {
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.send(metrics.format());
  });
  
  return app;
}
```

**server/src/sockets.js (использовать)**
```javascript
import { 
  socketConnectedCounter, 
  activePlayersGauge 
} from "./prometheus.js";

function trackPlayerConnect({ db, io, partyId, playerId, playerName }) {
  const prev = getActiveCount(playerId);
  const next = prev + 1;
  
  activeSocketsByPlayerId.set(playerId, next);
  socketConnectedCounter.inc();
  activePlayersGauge.set(activeSocketsByPlayerId.size);
  
  // ...rest of logic...
}
```

**Использование в Prometheus/Grafana:**
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'dnd-lan'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

**Приоритет:** P1  
**Estimated effort:** 2-3 часа

---

## 4. [SECURITY] ZIP Bomb Protection

### Проблема
При импорте backup может быть создан ZIP с миллионами маленьких файлов.
```
attacker.zip:
  - file1.txt (1 byte)
  - file2.txt (1 byte)
  - ...
  - file999999.txt (1 byte)
→ Распаковка заполнит диск и зависнёт процесс
```

### Решение: Limits на import

**server/src/bootstrap/app.js (добавить)**
```javascript
const BACKUP_IMPORT_MAX_FILES = 10000;
const BACKUP_IMPORT_MAX_SIZE = 500 * 1024 * 1024; // 500 MB uncompressed

export function backupImportHandler(req, res) {
  const db = getDb();
  const zipPath = req.file.path;
  
  try {
    // 1. Check file size on disk
    const stat = fs.statSync(zipPath);
    if (stat.size > BACKUP_IMPORT_MAX_SIZE) {
      return res.status(413).json({ 
        error: "backup_too_large",
        maxSizeBytes: BACKUP_IMPORT_MAX_SIZE 
      });
    }
    
    // 2. List entries before extracting
    let fileCount = 0;
    const archive = new unzipper.Parse();
    const readable = fs.createReadStream(zipPath);
    
    for await (const entry of archive.on('entry', (entry) => {
      fileCount++;
      if (fileCount > BACKUP_IMPORT_MAX_FILES) {
        readable.destroy();
        return res.status(413).json({
          error: "too_many_files_in_backup",
          maxFiles: BACKUP_IMPORT_MAX_FILES
        });
      }
      entry.autodrain();
    })) {
      // Process entries
    }
    
    // 3. Валидировать single-party constraint
    const parties = db.prepare("SELECT COUNT(*) as count FROM parties").get();
    if (parties.count > 1) {
      return res.status(400).json({
        error: "multiple_parties_not_supported"
      });
    }
    
    res.json({ ok: true });
  } catch (e) {
    logger.error({ err: e }, "backup import failed");
    res.status(500).json({ error: "import_failed" });
  }
}
```

**Тест:**
```javascript
// server/test/backupZipBomb.test.js
test("Backup с 10000+ файлов должен быть отклонён", async (t) => {
  // Создать ZIP с множеством маленьких файлов
  const archive = archiver("zip");
  for (let i = 0; i < 10001; i++) {
    archive.append(Buffer.from("x"), { name: `file${i}.txt` });
  }
  
  const res = await importBackup(archive);
  assert.strictEqual(res.status, 413);
  assert.match(res.body.error, /too_many_files/);
});
```

**Приоритет:** P1  
**Estimated effort:** 2-3 часа

---

## 5. [SECURITY] JWT_SECRET Environment Variable

### Проблема
Текущий код хранит secret на диске:
```javascript
// server/src/auth.js
const secretPath = path.join(DATA_DIR, ".jwt_secret");
```

Это OK для dev, но для production рекомендуется env.

### Решение

**server/src/auth.js (обновить)**
```javascript
export function getJwtSecret() {
  // Приоритет 1: Environment
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  // Приоритет 2: Cached value
  if (cachedSecret) {
    return cachedSecret;
  }
  
  // Приоритет 3: Disk (fallback для местного dev)
  const secretPath = path.join(DATA_DIR, ".jwt_secret");
  try {
    cachedSecret = fs.readFileSync(secretPath, "utf8").trim();
    if (cachedSecret) {
      logger.warn("Using JWT_SECRET from disk. For production use JWT_SECRET env.");
      return cachedSecret;
    }
  } catch {
    // Ignore
  }
  
  // Приоритет 4: Generate new (only for dev)
  if (process.env.NODE_ENV === "development") {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    cachedSecret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretPath, cachedSecret, { mode: 0o600 });
    logger.info("Generated new JWT_SECRET. Store it in JWT_SECRET env for production!");
    return cachedSecret;
  }
  
  // Production должен иметь JWT_SECRET
  throw new Error("JWT_SECRET environment variable is required for production");
}
```

**server/.env.example (добавить)**
```bash
# Security
JWT_SECRET=your-secret-key-min-32-chars-here-use-strong-random
DM_COOKIE=dm_token

# Optional: Override autogenerated location
# DND_LAN_DATA_DIR=/custom/data/path

# Backup
BACKUP_EVERY_MS=600000
BACKUP_RETAIN=20

# Presence
PRESENCE_GRACE_MS=4000
```

**Приоритет:** P1  
**Estimated effort:** 1-2 часа

---

## 6. [TEST] Expand Client-Side Tests

### Проблема
Client-side почти без тестов. Только серверные 48 тестов.

### Решение: Добавить Jest + React Testing Library

**client/package.json (обновить)**
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

**client/jest.config.js (новый файл)**
```javascript
export default {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.js"],
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(jpg|jpeg|png|gif|webp)$": "<rootDir>/src/test/fileMock.js"
  },
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest"
  },
  testMatch: ["<rootDir>/src/**/*.test.js"]
};
```

**client/src/test/setup.js**
```javascript
import "@testing-library/jest-dom";
```

**Пример теста: client/src/components/InventoryGrid.test.js**
```javascript
import { render, screen, fireEvent } from "@testing-library/react";
import { InventoryGrid } from "./InventoryGrid";

test("InventoryGrid должен отобразить items", () => {
  const items = [
    { id: 1, name: "Меч", weight: 5 },
    { id: 2, name: "Щит", weight: 10 }
  ];
  
  render(<InventoryGrid items={items} />);
  
  expect(screen.getByText("Меч")).toBeInTheDocument();
  expect(screen.getByText("Щит")).toBeInTheDocument();
});

test("Клик на item должен выбрать его", () => {
  const onSelect = jest.fn();
  const items = [{ id: 1, name: "Меч", weight: 5 }];
  
  render(<InventoryGrid items={items} onSelect={onSelect} />);
  
  fireEvent.click(screen.getByText("Меч"));
  
  expect(onSelect).toHaveBeenCalledWith(1);
});
```

**Приоритет:** P2  
**Estimated effort:** 4-5 часов (setup + tests)

---

## 7. [PERF] Performance Monitoring Dashboard

### Проблема
Нет визуального мониторинга JS bundle, image sizes, performance trends.

### Решение: Lightweight dashboard в React

**client/src/pages/PerfDashboard.jsx (новый)**
```jsx
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis } from "recharts";

export function PerfDashboard() {
  const [bundleSize, setBundleSize] = useState(null);
  
  useEffect(() => {
    // Fetch from /api/admin/perf
    fetch("/api/admin/perf")
      .then(r => r.json())
      .then(data => setBundleSize(data));
  }, []);
  
  if (!bundleSize) return <div>Loading...</div>;
  
  const target = 1025000;
  const remaining = target - bundleSize.totalJs;
  const percent = (bundleSize.totalJs / target * 100).toFixed(1);
  
  return (
    <div className="perf-dashboard">
      <h2>Performance Budget</h2>
      
      <div className="bundle-status">
        <progress value={percent} max="100" />
        <p>{bundleSize.totalJs} / {target} bytes ({percent}%)</p>
        {bundleSize.totalJs > target && (
          <p style={{ color: "red" }}>⚠️ Over budget!</p>
        )}
      </div>
      
      <BarChart width={500} height={300} data={[
        { name: "Total JS", size: bundleSize.totalJs / 1024 },
        { name: "Largest chunk", size: bundleSize.largestJs / 1024 }
      ]}>
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="size" fill="#8884d8" />
      </BarChart>
    </div>
  );
}
```

**server/src/routes/admin.js (новый)**
```javascript
import { getDb } from "../db.js";
import { getPerfMetrics } from "../perf.js";

export function registerAdminRoutes(app) {
  // Только для DM
  app.use("/api/admin/*", dmAuthMiddleware);
  
  app.get("/api/admin/perf", (req, res) => {
    const metrics = getPerfMetrics();
    res.json(metrics);
  });
  
  app.get("/api/admin/metrics", (req, res) => {
    // Prometheus format
    res.type("text/plain");
    res.send(formatPrometheusMetrics());
  });
}
```

**Приоритет:** P3  
**Estimated effort:** 3-4 часа

---

## SUMMARY TABLE

| # | Title | Priority | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | CSRF Protection | P0 | 3-4h | High (Security) |
| 2 | Inventory Race Condition | P0 | 4-6h | High (Data Integrity) |
| 3 | Prometheus Metrics | P1 | 2-3h | Medium (Ops) |
| 4 | ZIP Bomb Protection | P1 | 2-3h | Medium (Security) |
| 5 | JWT_SECRET Env | P1 | 1-2h | Low (Security) |
| 6 | Client-Side Tests | P2 | 4-5h | Medium (Quality) |
| 7 | Perf Dashboard | P3 | 3-4h | Low (DX) |

**Total:** 19-27 часов работы

---

## Заключение

Проект D&D LAN имеет **solid foundation**, но эти 7 пунктов значительно улучшат:
- 🔒 Security posture
- 📊 Reliability & monitoring
- 🧪 Test coverage
- 👁️ Observability

Рекомендуем реализовать **P0-P1 пункты** в течение двух спринтов.

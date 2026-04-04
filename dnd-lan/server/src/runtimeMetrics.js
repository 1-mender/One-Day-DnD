const HTTP_LATENCY_SAMPLE_LIMIT = 200;

const metricsState = {
  startedAt: Date.now(),
  http: {
    total: 0,
    totalErrors: 0,
    statusBuckets: {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0,
      other: 0
    },
    methods: {},
    latencySamplesMs: []
  },
  socket: {
    active: 0,
    connectedTotal: 0,
    disconnectedTotal: 0,
    authRejectedTotal: 0,
    staleWaitingRejectedTotal: 0,
    sessionInvalidTotal: 0,
    swapFailedTotal: 0,
    byRoleActive: {
      dm: 0,
      player: 0,
      waiting: 0,
      guest: 0
    }
  }
};

function pushLatencySample(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value < 0) return;
  metricsState.http.latencySamplesMs.push(value);
  if (metricsState.http.latencySamplesMs.length > HTTP_LATENCY_SAMPLE_LIMIT) {
    metricsState.http.latencySamplesMs.shift();
  }
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function toStatusBucket(statusCode) {
  const code = Number(statusCode);
  if (!Number.isFinite(code)) return "other";
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return "other";
}

export function recordHttpRequest({ method, statusCode, durationMs }) {
  metricsState.http.total += 1;
  const bucket = toStatusBucket(statusCode);
  metricsState.http.statusBuckets[bucket] = (metricsState.http.statusBuckets[bucket] || 0) + 1;

  const normalizedMethod = String(method || "UNKNOWN").toUpperCase();
  metricsState.http.methods[normalizedMethod] = (metricsState.http.methods[normalizedMethod] || 0) + 1;

  if (Number(statusCode) >= 500) {
    metricsState.http.totalErrors += 1;
  }
  pushLatencySample(durationMs);
}

export function createRuntimeMetricsMiddleware() {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.once("finish", () => {
      recordHttpRequest({
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });
    return next();
  };
}

export function recordSocketConnected(role) {
  const normalizedRole = String(role || "guest").toLowerCase();
  metricsState.socket.active += 1;
  metricsState.socket.connectedTotal += 1;
  metricsState.socket.byRoleActive[normalizedRole] = (metricsState.socket.byRoleActive[normalizedRole] || 0) + 1;
}

export function recordSocketDisconnected(role) {
  const normalizedRole = String(role || "guest").toLowerCase();
  metricsState.socket.active = Math.max(0, metricsState.socket.active - 1);
  metricsState.socket.disconnectedTotal += 1;
  metricsState.socket.byRoleActive[normalizedRole] = Math.max(
    0,
    (metricsState.socket.byRoleActive[normalizedRole] || 0) - 1
  );
}

export function recordSocketAuthRejected() {
  metricsState.socket.authRejectedTotal += 1;
}

export function recordStaleWaitingRejected() {
  metricsState.socket.staleWaitingRejectedTotal += 1;
}

export function recordSocketSessionInvalid() {
  metricsState.socket.sessionInvalidTotal += 1;
}

export function recordSocketSwapFailed() {
  metricsState.socket.swapFailedTotal += 1;
}

export function getRuntimeMetricsSnapshot() {
  const uptimeMs = Date.now() - metricsState.startedAt;
  const latencySamples = metricsState.http.latencySamplesMs;
  return {
    startedAt: metricsState.startedAt,
    uptimeMs,
    http: {
      total: metricsState.http.total,
      totalErrors: metricsState.http.totalErrors,
      statusBuckets: { ...metricsState.http.statusBuckets },
      methods: { ...metricsState.http.methods },
      latencyMs: {
        sampleCount: latencySamples.length,
        p50: percentile(latencySamples, 50),
        p95: percentile(latencySamples, 95),
        max: latencySamples.length ? Math.max(...latencySamples) : null
      }
    },
    socket: {
      active: metricsState.socket.active,
      connectedTotal: metricsState.socket.connectedTotal,
      disconnectedTotal: metricsState.socket.disconnectedTotal,
      authRejectedTotal: metricsState.socket.authRejectedTotal,
      staleWaitingRejectedTotal: metricsState.socket.staleWaitingRejectedTotal,
      sessionInvalidTotal: metricsState.socket.sessionInvalidTotal,
      swapFailedTotal: metricsState.socket.swapFailedTotal,
      byRoleActive: { ...metricsState.socket.byRoleActive }
    }
  };
}

export function resetRuntimeMetricsForTests() {
  metricsState.startedAt = Date.now();
  metricsState.http.total = 0;
  metricsState.http.totalErrors = 0;
  metricsState.http.statusBuckets = {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0
  };
  metricsState.http.methods = {};
  metricsState.http.latencySamplesMs = [];

  metricsState.socket.active = 0;
  metricsState.socket.connectedTotal = 0;
  metricsState.socket.disconnectedTotal = 0;
  metricsState.socket.authRejectedTotal = 0;
  metricsState.socket.staleWaitingRejectedTotal = 0;
  metricsState.socket.sessionInvalidTotal = 0;
  metricsState.socket.swapFailedTotal = 0;
  metricsState.socket.byRoleActive = {
    dm: 0,
    player: 0,
    waiting: 0,
    guest: 0
  };
}

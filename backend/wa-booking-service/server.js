const http = require("http");
const express = require("express");
const bookingRoutes = require("./routes/booking");
const whatsappRoutes = require("./routes/whatsapp");
const { getDebugState } = require("./services/bookingService");
const { runParserSelfChecks } = require("./services/parser");

const DEFAULT_PORT = 8081;
const AUTO_PORT_MAX_TRIES = 40;

const explicitPortEnv = process.env.PORT;
const explicitPort =
  explicitPortEnv !== undefined && String(explicitPortEnv).trim() !== ""
    ? Number.parseInt(String(explicitPortEnv).trim(), 10)
    : null;

/** Railway and other containers must bind all interfaces; localhost-only breaks the proxy. */
const listenHost = (process.env.LISTEN_HOST ?? "0.0.0.0").trim() || "0.0.0.0";

/** Railway-provided vars — used to optionally bind :8081 when PORT ≠ 8081 (legacy Expo target port). */
const onRailway = Boolean(
  process.env.RAILWAY_PUBLIC_DOMAIN ||
    process.env.RAILWAY_PRIVATE_DOMAIN ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID,
);
const extra8081Disabled =
  process.env.RAILWAY_EXTRA_LISTEN_8081 === "0" || process.env.RAILWAY_EXTRA_LISTEN_8081 === "false";

if (explicitPort !== null && (Number.isNaN(explicitPort) || explicitPort < 1 || explicitPort > 65535)) {
  console.error("[server] Invalid PORT:", explicitPortEnv);
  process.exit(1);
}

const app = express();

runParserSelfChecks();

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, service: "wa-booking-service", message: "Use GET /health for probes." });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "wa-booking-service" });
});

app.use("/webhook", bookingRoutes);
app.use("/webhook", whatsappRoutes);

app.get("/debug/state", (_req, res) => {
  res.status(200).json(getDebugState());
});

app.use((err, _req, res, _next) => {
  console.error("[server] unhandled route error", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

/**
 * Custom domains that used to point at Expo often had internal **target port 8081**.
 * Railway injects a different `PORT` (e.g. 8080). The edge then forwards to 8081 and nothing answers.
 * We bind the same app on 8081 as well when on Railway and `PORT` is not already 8081.
 * Prefer fixing Networking → custom domain → target port to match `PORT`, then set `RAILWAY_EXTRA_LISTEN_8081=0`.
 *
 * @param {number} primaryPort
 */
function maybeListenRailwayLegacy8081(primaryPort) {
  if (!onRailway || extra8081Disabled) return;
  if (explicitPort === null || primaryPort === 8081) return;

  const legacy = http.createServer(app);
  legacy.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.warn(
        "[server] :8081 busy — skipping secondary listener. Set Railway custom domain target port to match PORT.",
      );
      return;
    }
    console.error("[server] secondary :8081 listen error", err);
  });
  legacy.listen(8081, listenHost, () => {
    console.log(
      `[server] Secondary listener on :8081 (legacy Expo-style target). Prefer clearing that target in Railway Networking so only PORT=${primaryPort} is used; then set RAILWAY_EXTRA_LISTEN_8081=0.`,
    );
  });
}

/**
 * @param {number} port
 * @param {number} attemptIndex
 */
function listenOnPort(port, attemptIndex) {
  const server = http.createServer(app);

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      if (explicitPort !== null) {
        console.error(`[server] Port ${port} is already in use (PORT is set explicitly).`);
        console.error(`[server] Stop the other process or set PORT to a free port (e.g. PORT=3082).`);
        console.error(`[server] Windows: netstat -ano | findstr :${port}`);
        process.exit(1);
      }
      const nextPort = port + 1;
      if (attemptIndex + 1 >= AUTO_PORT_MAX_TRIES) {
        console.error(
          `[server] No free port found after ${AUTO_PORT_MAX_TRIES} tries starting from ${DEFAULT_PORT}.`,
        );
        process.exit(1);
      }
      console.warn(`[server] Port ${port} is in use, trying ${nextPort}…`);
      listenOnPort(nextPort, attemptIndex + 1);
      return;
    }
    console.error("[server] listen error", err);
    process.exit(1);
  });

  server.listen(port, listenHost, () => {
    if (explicitPort === null && port !== DEFAULT_PORT) {
      console.warn(
        `[server] Using port ${port} because ${DEFAULT_PORT} was busy. Set WA_BOOKING_SERVICE_URL accordingly for Supabase.`,
      );
    }
    console.log(
      `[server] wa-booking-service primary http://${listenHost}:${port} (Railway: set custom domain target port to ${port} if traffic still fails)`,
    );
    maybeListenRailwayLegacy8081(port);
  });
}

const startPort = explicitPort !== null ? explicitPort : DEFAULT_PORT;
listenOnPort(startPort, 0);

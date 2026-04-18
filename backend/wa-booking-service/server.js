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

if (explicitPort !== null && (Number.isNaN(explicitPort) || explicitPort < 1 || explicitPort > 65535)) {
  console.error("[server] Invalid PORT:", explicitPortEnv);
  process.exit(1);
}

const app = express();

runParserSelfChecks();

app.use(express.json({ limit: "1mb" }));

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

  server.listen(port, () => {
    if (explicitPort === null && port !== DEFAULT_PORT) {
      console.warn(
        `[server] Using port ${port} because ${DEFAULT_PORT} was busy. Set WA_BOOKING_SERVICE_URL accordingly for Supabase.`,
      );
    }
    console.log(`[server] wa-booking-service listening on http://localhost:${port}`);
  });
}

const startPort = explicitPort !== null ? explicitPort : DEFAULT_PORT;
listenOnPort(startPort, 0);

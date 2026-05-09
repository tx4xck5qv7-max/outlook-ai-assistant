require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");

const emailRoutes =
  require("./src/routes/emailRoutes");

const app = express();

const allowedOrigins = new Set([
  "https://localhost:3001",
  "https://127.0.0.1:3001"
]);

const rateLimitWindowMs = 5 * 60 * 1000;
const rateLimitMaxRequests = 30;
const requestCounts = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key =
    req.ip ||
    req.socket.remoteAddress ||
    "local";

  const current =
    requestCounts.get(key);

  const entry =
    current && current.resetAt > now
      ? current
      : {
        count: 0,
        resetAt: now + rateLimitWindowMs
      };

  entry.count += 1;
  requestCounts.set(key, entry);

  if (entry.count > rateLimitMaxRequests) {
    return res.status(429).json({
      error: "Zu viele Anfragen. Bitte kurz warten."
    });
  }

  next();
}

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS origin not allowed"));
  }
}));

app.use(express.json({
  limit: "512kb"
}));

const sslPath =
  path.join(__dirname, "ssl");

const options = {
  key: fs.readFileSync(
    path.join(sslPath, "key.pem")
  ),
  cert: fs.readFileSync(
    path.join(sslPath, "cert.pem")
  )
};

app.use(
  "/api/email",
  rateLimit,
  emailRoutes
);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    storage: "none",
    transport: "https",
    api: "ready"
  });
});

app.get("/", (req, res) => {
  res.send(
    "OK - Outlook AI Backend läuft"
  );
});

app.get("/taskpane.html", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../frontend/outlook-addin/taskpane.html"
    )
  );
});

app.get("/taskpane.js", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../frontend/outlook-addin/taskpane.js"
    )
  );
});

app.get("/taskpane.css", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../frontend/outlook-addin/taskpane.css"
    )
  );
});

app.get("/icon.png", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../frontend/outlook-addin/icon.png"
    )
  );
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message === "CORS origin not allowed") {
    return res.status(403).json({
      error: "Origin nicht erlaubt"
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Anfrage ist zu gross"
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Ungueltiges JSON"
    });
  }

  console.error("Server Fehler:", err.message);

  return res.status(500).json({
    error: "Server Fehler"
  });
});

https
  .createServer(options, app)
  .listen(3001, "127.0.0.1", () => {

    console.log(
      "AI SERVER RUNNING https://127.0.0.1:3001"
    );
  });

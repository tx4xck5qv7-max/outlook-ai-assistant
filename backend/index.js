require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const path = require("path");

const emailRoutes =
  require("./src/routes/emailRoutes");

const app = express();

app.use(cors());

app.use(express.json());

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
  emailRoutes
);

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

https
  .createServer(options, app)
  .listen(3001, "127.0.0.1", () => {

    console.log(
      "AI SERVER RUNNING https://127.0.0.1:3001"
    );
  });
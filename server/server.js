const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const app = express();
app.use(cors());

const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});

const wss = new WebSocketServer({ server });

const rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "join") {
      ws.room = data.room;

      if (!rooms[data.room]) {
        rooms[data.room] = [];
      }

      rooms[data.room].push(ws);
      return;
    }

    const clients = rooms[ws.room] || [];

    clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room] = rooms[ws.room].filter((c) => c !== ws);
    }
  });
});

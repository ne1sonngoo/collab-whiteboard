const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });

const BROADCAST_ALL = new Set(["clear_board"]);
const BROADCAST_OTHERS = new Set([
  "draw",
  "note_create",
  "note_move",
  "note_update",
  "cursor_move",
]);

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (BROADCAST_ALL.has(data.type)) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } else if (BROADCAST_OTHERS.has(data.type)) {
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  });
});

console.log("WebSocket server running on port 3001");

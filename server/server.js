/**
 * server.js
 * WebSocket server with per-room state persistence.
 * Each connected client is tagged with its roomId for scoped broadcasting.
 */
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });
const rooms = {}; // { [roomId]: { strokes: DrawEvent[], notes: { [id]: Note } } }

const MAX_STROKES = 10_000;

// ── Room helpers ─────────────────────────────────────────────────────────────
function getRoom(id) {
  if (!rooms[id]) rooms[id] = { strokes: [], notes: {} };
  return rooms[id];
}

function broadcast(senderWs, data, { includeSelf = false } = {}) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.roomId !== senderWs.roomId) return;
    if (!includeSelf && client === senderWs) return;
    client.send(msg);
  });
}

// ── Message handlers (one function per message type) ─────────────────────────
const handlers = {
  join(ws, data) {
    ws.roomId = String(data.room);
    const room = getRoom(ws.roomId);
    ws.send(
      JSON.stringify({
        type: "init",
        strokes: room.strokes,
        notes: Object.values(room.notes),
      }),
    );
  },

  draw(ws, data) {
    const room = getRoom(ws.roomId);
    room.strokes.push(data);
    if (room.strokes.length > MAX_STROKES) room.strokes.shift();
    broadcast(ws, data);
  },

  clear_board(ws, data) {
    getRoom(ws.roomId).strokes = [];
    broadcast(ws, data, { includeSelf: true });
  },

  note_create(ws, data) {
    getRoom(ws.roomId).notes[data.note.id] = { ...data.note };
    broadcast(ws, data);
  },

  note_move(ws, data) {
    const note = getRoom(ws.roomId).notes[data.id];
    if (note) {
      note.x = data.x;
      note.y = data.y;
    }
    broadcast(ws, data);
  },

  note_update(ws, data) {
    const note = getRoom(ws.roomId).notes[data.id];
    if (note) note.text = data.text;
    broadcast(ws, data);
  },

  cursor_move(ws, data) {
    broadcast(ws, data);
  },
};

// ── Connection ────────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  ws.roomId = null;

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("[server] Invalid JSON from client:", err.message);
      return;
    }

    if (!data?.type) return;

    // join is allowed before roomId is set; everything else requires it
    if (data.type !== "join" && !ws.roomId) {
      console.warn("[server] Message before join:", data.type);
      return;
    }

    const handler = handlers[data.type];
    if (!handler) {
      console.warn("[server] Unknown message type:", data.type);
      return;
    }

    try {
      handler(ws, data);
    } catch (err) {
      console.error(`[server] Error handling "${data.type}":`, err);
    }
  });

  ws.on("close", () => {
    ws.roomId = null;
  });
  ws.on("error", (err) => console.error("[server] WS error:", err.message));
});

wss.on("error", (err) => console.error("[server] Server error:", err));

console.log("WebSocket server running on port 3001");

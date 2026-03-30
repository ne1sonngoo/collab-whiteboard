/**
 * server.js
 * WebSocket server with per-room state and collaborative undo support.
 */
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });
const rooms = {}; // { [roomId]: { strokes: DrawEvent[], notes: { [id]: Note } } }

const MAX_STROKES = 10_000;

function getRoom(id) {
  if (!rooms[id]) rooms[id] = { strokes: [], notes: {} };
  return rooms[id];
}

// Send to all clients in the same room, optionally including the sender
function broadcast(senderWs, data, { includeSelf = false } = {}) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.roomId !== senderWs.roomId) return;
    if (!includeSelf && client === senderWs) return;
    client.send(msg);
  });
}

// Send the full room state to every client in the room (used after undo)
function broadcastInit(roomId) {
  const room = getRoom(roomId);
  const msg = JSON.stringify({
    type: "init",
    strokes: room.strokes,
    notes: Object.values(room.notes),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId) {
      client.send(msg);
    }
  });
}

// ── Message handlers ─────────────────────────────────────────────────────────
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

  // Pop the last stroke belonging to this userId, then resync every client
  undo_last(ws, data) {
    const room = getRoom(ws.roomId);
    // Walk backwards and remove the most recent stroke from this user
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === data.userId) {
        room.strokes.splice(i, 1);
        break;
      }
    }
    // Broadcast full state to everyone (including sender) so all canvases resync
    broadcastInit(ws.roomId);
  },

  clear_board(ws) {
    getRoom(ws.roomId).strokes = [];
    broadcast(ws, { type: "clear_board" }, { includeSelf: true });
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

  note_delete(ws, data) {
    delete getRoom(ws.roomId).notes[data.id];
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
      console.error("[server] Invalid JSON:", err.message);
      return;
    }

    if (!data?.type) return;

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
      console.error(`[server] Error in "${data.type}" handler:`, err);
    }
  });

  ws.on("close", () => {
    ws.roomId = null;
  });
  ws.on("error", (err) =>
    console.error("[server] WS client error:", err.message),
  );
});

wss.on("error", (err) => console.error("[server] Server error:", err));

console.log("WebSocket server running on port 3001");

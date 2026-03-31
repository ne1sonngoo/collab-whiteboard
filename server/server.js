/**
 * server.js
 * WebSocket server with per-room state, collaborative undo, and room naming.
 */
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });
const rooms = {};
const MAX_STROKES = 10_000;

function getRoom(id) {
  if (!rooms[id]) rooms[id] = { strokes: [], notes: {}, name: "" };
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

function broadcastInit(roomId) {
  const room = getRoom(roomId);
  const msg = JSON.stringify({
    type: "init",
    strokes: room.strokes,
    notes: Object.values(room.notes),
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId)
      client.send(msg);
  });
}

const handlers = {
  join(ws, data) {
    ws.roomId = String(data.room);
    const room = getRoom(ws.roomId);
    // Send board state
    ws.send(
      JSON.stringify({
        type: "init",
        strokes: room.strokes,
        notes: Object.values(room.notes),
      }),
    );
    // Send current room name separately so client can update title
    ws.send(JSON.stringify({ type: "room_info", name: room.name }));
  },

  draw(ws, data) {
    const room = getRoom(ws.roomId);
    room.strokes.push(data);
    if (room.strokes.length > MAX_STROKES) room.strokes.shift();
    broadcast(ws, data);
  },

  undo_last(ws, data) {
    const room = getRoom(ws.roomId);
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === data.userId) {
        room.strokes.splice(i, 1);
        break;
      }
    }
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

  room_rename(ws, data) {
    const room = getRoom(ws.roomId);
    room.name = String(data.name || "").slice(0, 80); // cap at 80 chars
    // Broadcast to everyone including sender so all tabs update
    broadcast(
      ws,
      { type: "room_rename", name: room.name },
      { includeSelf: true },
    );
  },
};

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
      console.warn("[server] Unknown type:", data.type);
      return;
    }
    try {
      handler(ws, data);
    } catch (err) {
      console.error(`[server] Error in "${data.type}":`, err);
    }
  });

  ws.on("close", () => {
    ws.roomId = null;
  });
  ws.on("error", (err) => console.error("[server] WS error:", err.message));
});

wss.on("error", (err) => console.error("[server] Server error:", err));
console.log("WebSocket server running on port 3001");

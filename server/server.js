/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Node.js WebSocket server for the collaborative whiteboard.
 *
 * Responsibilities:
 *   • Maintain per-room state: strokes, notes, room name, connected users
 *   • On join  → send full board state + room name + presence list to joiner,
 *                broadcast updated presence list to everyone else
 *   • On leave → broadcast updated presence list so others know someone left
 *   • Relay draw / note / cursor events between clients in the same room
 *   • Handle undo by removing the sender's last stroke and resyncing all clients
 *   • Handle room rename by persisting + broadcasting the new name
 *
 * State is in-memory only — restarting the server clears all boards.
 */

const WebSocket = require("ws");

// Create the WebSocket server on port 3001.
// The React dev server (Vite, port 5173) proxies or the client connects directly.
const wss = new WebSocket.Server({ port: 3001 });

// ── Per-room state ────────────────────────────────────────────────────────────
// rooms[roomId] = {
//   strokes : DrawEvent[]        — every committed draw event, replayed for late joiners
//   notes   : { [id]: Note }     — all live sticky notes, keyed by note id
//   name    : string             — display name of the room
//   users   : { [userId]: User } — currently connected users { userId, username, color }
// }
const rooms = {};

// Hard cap on stored strokes per room to prevent unbounded memory growth.
// At ~200 bytes per stroke, 10 000 strokes ≈ 2 MB per room.
const MAX_STROKES = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the room object for roomId, creating it if it doesn't exist yet. */
function getRoom(id) {
  if (!rooms[id]) rooms[id] = { strokes: [], notes: {}, name: "", users: {} };
  return rooms[id];
}

/**
 * Send a message to every connected client in the same room as senderWs.
 * @param {WebSocket} senderWs   — the client who triggered the event
 * @param {object}    data       — the message payload (will be JSON-stringified)
 * @param {boolean}   includeSelf — whether to also send back to the sender
 */
function broadcast(senderWs, data, { includeSelf = false } = {}) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return; // skip closed sockets
    if (client.roomId !== senderWs.roomId) return; // skip different rooms
    if (!includeSelf && client === senderWs) return; // skip sender if not included
    client.send(msg);
  });
}

/**
 * Send { type: "init", strokes, notes } to every client in roomId.
 * Called after an undo so all canvases resync from the authoritative server state.
 */
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

/**
 * Send the current presence list (all connected users in the room) to everyone.
 * Called whenever someone joins or leaves so all clients stay in sync.
 */
function broadcastPresence(roomId) {
  const room = getRoom(roomId);
  const users = Object.values(room.users); // array of { userId, username, color }
  const msg = JSON.stringify({ type: "presence_update", users });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId)
      client.send(msg);
  });
}

// ── Message handlers ──────────────────────────────────────────────────────────
// One function per message type keeps each handler small and independently testable.
// Canvas.jsx's handleSocketMessage switch-cases correspond 1-to-1 with these.

const handlers = {
  /**
   * join — first message a client sends after connecting.
   * Registers the user, sends current board state, then broadcasts updated presence.
   */
  join(ws, data) {
    ws.roomId = String(data.room); // tag the socket so broadcast() can filter by room
    ws.userId = data.userId || ws.roomId + "-anon";
    ws.username = data.username || "User";
    ws.color = data.color || "#3b82f6";

    const room = getRoom(ws.roomId);

    // Register this user in the room's presence map
    room.users[ws.userId] = {
      userId: ws.userId,
      username: ws.username,
      color: ws.color,
    };

    // 1. Send full board state (strokes + notes) so the joiner can repaint
    ws.send(
      JSON.stringify({
        type: "init",
        strokes: room.strokes,
        notes: Object.values(room.notes),
      }),
    );

    // 2. Send the current room name separately
    ws.send(JSON.stringify({ type: "room_info", name: room.name }));

    // 3. Broadcast updated presence list to everyone (including the new joiner)
    broadcastPresence(ws.roomId);
  },

  /**
   * draw — a single committed drawing operation.
   * Persisted so late joiners replay it; relayed to all other clients.
   */
  draw(ws, data) {
    const room = getRoom(ws.roomId);
    room.strokes.push(data); // store stroke for future init replays
    if (room.strokes.length > MAX_STROKES) room.strokes.shift(); // drop oldest if over cap
    broadcast(ws, data); // relay to everyone else in the room
  },

  /**
   * undo_last — remove the sender's most recent stroke from server state,
   * then send a full init to all clients so everyone repaints in sync.
   */
  undo_last(ws, data) {
    const room = getRoom(ws.roomId);
    // Walk backwards to find and remove the last stroke belonging to this user
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === data.userId) {
        room.strokes.splice(i, 1);
        break; // only remove one stroke per undo
      }
    }
    // Resync every client's canvas from the now-modified stroke list
    broadcastInit(ws.roomId);
  },

  /**
   * clear_board — wipe all strokes from server state and all client canvases.
   * includeSelf: true so the clearing client also receives the event and clears.
   */
  clear_board(ws) {
    getRoom(ws.roomId).strokes = [];
    broadcast(ws, { type: "clear_board" }, { includeSelf: true });
  },

  /** note_create — add a new sticky note to room state and relay to others. */
  note_create(ws, data) {
    getRoom(ws.roomId).notes[data.note.id] = { ...data.note };
    broadcast(ws, data);
  },

  /** note_move — update a note's position in room state and relay to others. */
  note_move(ws, data) {
    const note = getRoom(ws.roomId).notes[data.id];
    if (note) {
      note.x = data.x;
      note.y = data.y;
    }
    broadcast(ws, data);
  },

  /** note_update — update a note's text content in room state and relay. */
  note_update(ws, data) {
    const note = getRoom(ws.roomId).notes[data.id];
    if (note) note.text = data.text;
    broadcast(ws, data);
  },

  /** note_delete — remove a note from room state and relay to others. */
  note_delete(ws, data) {
    delete getRoom(ws.roomId).notes[data.id];
    broadcast(ws, data);
  },

  /**
   * cursor_move — live cursor position broadcast.
   * Not persisted (no point replaying cursor history) — just relayed.
   */
  cursor_move(ws, data) {
    // Update the stored username in case it changed since join
    const room = getRoom(ws.roomId);
    if (room.users[data.userId]) {
      room.users[data.userId].username =
        data.username || room.users[data.userId].username;
    }
    broadcast(ws, data);
  },

  /**
   * room_rename — update the room's display name.
   * Capped at 80 chars server-side. Broadcast to everyone so all tabs update.
   */
  room_rename(ws, data) {
    const room = getRoom(ws.roomId);
    room.name = String(data.name || "").slice(0, 80);
    broadcast(
      ws,
      { type: "room_rename", name: room.name },
      { includeSelf: true },
    );
  },
};

// ── Connection lifecycle ──────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  // Tag with null until the client sends a "join" message
  ws.roomId = null;
  ws.userId = null;
  ws.username = null;

  ws.on("message", (raw) => {
    // Parse the incoming JSON — log and bail on malformed messages
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("[server] Invalid JSON from client:", err.message);
      return;
    }

    if (!data?.type) return; // ignore messages with no type field

    // All message types except "join" require the client to have joined a room first
    if (data.type !== "join" && !ws.roomId) {
      console.warn("[server] Message before join:", data.type);
      return;
    }

    // Look up and call the appropriate handler
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
    // Remove user from presence and notify remaining clients
    if (ws.roomId && ws.userId) {
      const room = rooms[ws.roomId];
      if (room) {
        delete room.users[ws.userId];
        broadcastPresence(ws.roomId);
      }
    }
    ws.roomId = null;
  });

  ws.on("error", (err) =>
    console.error("[server] WS client error:", err.message),
  );
});

wss.on("error", (err) => console.error("[server] Server error:", err));

console.log("WebSocket server running on port 3001");

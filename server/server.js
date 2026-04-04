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
 *   • Handle undo: pop the sender's last stroke into their personal redo stack,
 *                  then rebroadcast full state so all canvases resync
 *   • Handle redo: pop the sender's last undone stroke back into the main list,
 *                  then rebroadcast full state so all canvases resync
 *   • Handle room rename: persist + broadcast the new name
 *
 * State is in-memory only — restarting the server clears all boards.
 */

const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });

// ── Per-room state ────────────────────────────────────────────────────────────
// rooms[roomId] = {
//   strokes    : DrawEvent[]              — committed strokes, replayed for late joiners
//   notes      : { [id]: Note }          — live sticky notes keyed by note id
//   name       : string                  — display name of the room
//   users      : { [userId]: User }      — currently connected users
//   redoStacks : { [userId]: DrawEvent[] } — per-user redo stacks populated by undo_last
// }
const rooms = {};

// Hard cap on stored strokes to prevent unbounded memory growth
const MAX_STROKES = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the room object for roomId, creating it if it doesn't exist yet. */
function getRoom(id) {
  if (!rooms[id]) {
    rooms[id] = { strokes: [], notes: {}, name: "", users: {}, redoStacks: {} };
  }
  return rooms[id];
}

/**
 * Send a message to every connected client in the same room as senderWs.
 * @param {WebSocket} senderWs    — the client who triggered the event
 * @param {object}    data        — the message payload (will be JSON-stringified)
 * @param {boolean}   includeSelf — whether to also send back to the sender
 */
function broadcast(senderWs, data, { includeSelf = false } = {}) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return; // skip closed sockets
    if (client.roomId !== senderWs.roomId) return; // skip different rooms
    if (!includeSelf && client === senderWs) return; // optionally skip sender
    client.send(msg);
  });
}

/**
 * Send { type: "init", strokes, notes } to every client in roomId.
 * Called after undo or redo so all canvases repaint from the authoritative
 * server stroke list, keeping everyone perfectly in sync.
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
 * Send the current presence list to every client in the room.
 * Called whenever someone joins or leaves so all UIs stay accurate.
 */
function broadcastPresence(roomId) {
  const room = getRoom(roomId);
  const users = Object.values(room.users);
  const msg = JSON.stringify({ type: "presence_update", users });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomId === roomId)
      client.send(msg);
  });
}

// ── Message handlers ──────────────────────────────────────────────────────────
// One function per message type — small, independently readable, easy to test.

const handlers = {
  /**
   * join — first message a client sends after connecting.
   * Registers the user, sends current board state + room name, broadcasts presence.
   */
  join(ws, data) {
    ws.roomId = String(data.room);
    ws.userId = data.userId || `anon-${Date.now()}`;
    ws.username = data.username || "User";
    ws.color = data.color || "#3b82f6";

    const room = getRoom(ws.roomId);

    // Register this user in the room's presence map
    room.users[ws.userId] = {
      userId: ws.userId,
      username: ws.username,
      color: ws.color,
    };

    // Initialise this user's redo stack if they don't have one yet
    if (!room.redoStacks[ws.userId]) room.redoStacks[ws.userId] = [];

    // 1. Send full board state so the joiner can repaint
    ws.send(
      JSON.stringify({
        type: "init",
        strokes: room.strokes,
        notes: Object.values(room.notes),
      }),
    );

    // 2. Send the current room name
    ws.send(JSON.stringify({ type: "room_info", name: room.name }));

    // 3. Broadcast updated presence list to everyone including the new joiner
    broadcastPresence(ws.roomId);
  },

  /**
   * draw — a single committed drawing operation.
   * Persisted for future init replays; relayed to all other clients.
   * Clears this user's redo stack because a new action invalidates undone history.
   */
  draw(ws, data) {
    const room = getRoom(ws.roomId);

    // A new draw action invalidates any pending redos for this user,
    // just like typing in a text editor after undoing clears the redo history
    if (room.redoStacks[ws.userId]) room.redoStacks[ws.userId] = [];

    room.strokes.push(data);
    if (room.strokes.length > MAX_STROKES) room.strokes.shift();
    broadcast(ws, data);
  },

  /**
   * undo_last — remove the sender's most recent stroke from server state.
   * The removed stroke is pushed onto this user's personal redo stack so
   * redo_last can restore it. Broadcasts full init so all canvases resync.
   */
  undo_last(ws, data) {
    const room = getRoom(ws.roomId);

    // Ensure redo stack exists for this user
    if (!room.redoStacks[ws.userId]) room.redoStacks[ws.userId] = [];

    // Walk backwards to find and remove the last stroke belonging to this user
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === data.userId) {
        // Push the removed stroke onto the redo stack before deleting it
        room.redoStacks[ws.userId].push(room.strokes[i]);
        room.strokes.splice(i, 1);
        break; // only remove one stroke per undo
      }
    }

    // Resync every client's canvas from the updated stroke list
    broadcastInit(ws.roomId);
  },

  /**
   * redo_last — restore the sender's most recently undone stroke.
   * Pops from the user's redo stack, re-inserts into the main stroke list,
   * and broadcasts full init so all canvases resync.
   */
  redo_last(ws, data) {
    const room = getRoom(ws.roomId);
    const redoStack = room.redoStacks[ws.userId];

    // Nothing to redo for this user
    if (!redoStack || redoStack.length === 0) return;

    // Pop the most recently undone stroke and re-add it to the stroke list
    const stroke = redoStack.pop();
    room.strokes.push(stroke);

    // Resync every client's canvas with the restored stroke
    broadcastInit(ws.roomId);
  },

  /**
   * clear_board — wipe all strokes from server state and all client canvases.
   * Also clears all users' redo stacks since there's nothing to redo into.
   * includeSelf: true so the clearing client also receives the event.
   */
  clear_board(ws) {
    const room = getRoom(ws.roomId);
    room.strokes = [];
    // Clear all redo stacks — can't redo into a blank board
    Object.keys(room.redoStacks).forEach((uid) => {
      room.redoStacks[uid] = [];
    });
    broadcast(ws, { type: "clear_board" }, { includeSelf: true });
  },

  /** note_create — add a new sticky note to room state and relay to others. */
  note_create(ws, data) {
    // Store the full note object including createdBy so it persists for late joiners
    getRoom(ws.roomId).notes[data.note.id] = { ...data.note };
    broadcast(ws, data);
  },

  /** note_move — update a note's position in room state and relay. */
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
   * cursor_move — live cursor position.
   * Not persisted (no point replaying cursor history) — just relayed.
   * Also updates the stored username in case it changed since join.
   */
  cursor_move(ws, data) {
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
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error("[server] Invalid JSON from client:", err.message);
      return;
    }

    if (!data?.type) return;

    // All message types except "join" require the client to have joined a room first
    if (data.type !== "join" && !ws.roomId) {
      console.warn("[server] Message received before join:", data.type);
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
    // Remove user from presence and notify remaining clients
    if (ws.roomId && ws.userId) {
      const room = rooms[ws.roomId];
      if (room) {
        delete room.users[ws.userId];
        // Keep their redo stack in case they reconnect — it's small and bounded
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

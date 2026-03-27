const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3001 });

const rooms = {}; // { roomId: { strokes: [], notes: {} } }
const MAX_STROKES = 10000;

function getRoom(id) {
  if (!rooms[id]) rooms[id] = { strokes: [], notes: {} };
  return rooms[id];
}

function broadcast(senderWs, data, includeSender = false) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (!includeSender && client === senderWs) return;
    // Only send to clients in the same room
    if (client.roomId !== senderWs.roomId) return;
    client.send(msg);
  });
}

wss.on("connection", (ws) => {
  ws.roomId = null;

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.type === "join") {
      ws.roomId = String(data.room);
      const room = getRoom(ws.roomId);
      ws.send(
        JSON.stringify({
          type: "init",
          strokes: room.strokes,
          notes: Object.values(room.notes),
        }),
      );
      return;
    }

    if (!ws.roomId) return;
    const room = getRoom(ws.roomId);

    switch (data.type) {
      case "draw":
        room.strokes.push(data);
        if (room.strokes.length > MAX_STROKES) room.strokes.shift();
        broadcast(ws, data);
        break;
      case "clear_board":
        room.strokes = [];
        broadcast(ws, data, true); // everyone including sender
        break;
      case "note_create":
        room.notes[data.note.id] = { ...data.note };
        broadcast(ws, data);
        break;
      case "note_move":
        if (room.notes[data.id]) {
          room.notes[data.id].x = data.x;
          room.notes[data.id].y = data.y;
        }
        broadcast(ws, data);
        break;
      case "note_update":
        if (room.notes[data.id]) {
          room.notes[data.id].text = data.text;
        }
        broadcast(ws, data);
        break;
      case "cursor_move":
        broadcast(ws, data);
        break;
    }
  });

  ws.on("close", () => {
    ws.roomId = null;
  });
});

console.log("WebSocket server running on port 3001");

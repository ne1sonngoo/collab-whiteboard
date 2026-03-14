// Import libraries we installed
const express = require("express");
const cors = require("cors");
// WebSocket library
const { WebSocketServer } = require("ws");
// Create express app
const app = express();
// Allow frontend to connect
app.use(cors());
// Start HTTP server on port 3001
const server = app.listen(3001, () => {
  console.log("Server running on port 3001");
});
/*
WebSocket server sits on top of the HTTP server
*/
const wss = new WebSocketServer({ server });

/*
Rooms store which users belong to which board
Example structure:
rooms = {
  "test": [user1, user2],
  "design": [user3]
}
*/
const rooms = {};
/*
When a client connects via WebSocket
*/
wss.on("connection", (ws) => {
  /*
  ws = one connected user
  */
  ws.on("message", (message) => {
    // Convert message string into object
    const data = JSON.parse(message);
    /*
    USER JOINING A BOARD
    */
    if (data.type === "join") {
      // Store which room this user belongs to
      ws.room = data.room;
      // Create room if it doesn't exist
      if (!rooms[data.room]) {
        rooms[data.room] = [];
      }
      // Add user to the room
      rooms[data.room].push(ws);
      return;
    }

    /*
    BROADCAST EVENT TO OTHER USERS
    */
    const clients = rooms[ws.room] || [];
    clients.forEach((client) => {
      // Don't send message back to sender
      if (client !== ws && client.readyState === 1) {
        // Send message
        client.send(JSON.stringify(data));
      }
    });
  });

  /*
  User disconnects
  */
  ws.on("close", () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room] = rooms[ws.room].filter((c) => c !== ws);
    }
  });
});

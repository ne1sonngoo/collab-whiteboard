# 🎨 Collab Whiteboard

A real-time collaborative whiteboard built with React, Node.js, and WebSockets. Multiple users can draw, add shapes, place sticky notes, and see each other's cursors — all synced live across every connected browser.

---

## Features

- **Drawing tools** — Pen, Eraser, Line, Rectangle, Ellipse, Text, Fill (flood fill)
- **Sticky notes** — Drag to reposition, edit text inline, delete; all synced in real time
- **Undo / redo** — Ctrl+Z / Ctrl+Y; undo is collaborative (removes your stroke for everyone)
- **Zoom & pan** — Scroll wheel to zoom, Space+drag or middle-mouse to pan
- **Persistent board state** — Late joiners and page refreshes replay the full board
- **Room names** — Click the board title to rename; synced to all clients instantly
- **Presence list** — See who's currently on the board with colored avatars
- **Remote cursors** — See other users' cursor positions in real time
- **Export** — Save the board as a PNG (includes sticky notes)
- **Error boundary** — Friendly fallback UI instead of a blank screen on crashes
- **Docker support** — Single-command deployment with Docker Compose

---

## Project Structure

```
collab-whiteboard/
├── client/                      # Vite + React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/          # React UI components
│   │   │   ├── Canvas.jsx           # Top-level board orchestrator
│   │   │   ├── Toolbar.jsx          # Tool/color/size controls
│   │   │   ├── StickyNote.jsx       # Draggable editable note
│   │   │   ├── RemoteCursors.jsx    # Other users' cursor dots
│   │   │   ├── TextInputOverlay.jsx # Floating textarea for Text tool
│   │   │   ├── ZoomBadge.jsx        # Zoom % indicator + reset
│   │   │   ├── RoomTitle.jsx        # Editable board name
│   │   │   ├── PresenceList.jsx     # Connected user avatars
│   │   │   └── ErrorBoundary.jsx    # Catches render errors gracefully
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useSocket.js         # WebSocket connection + message routing
│   │   │   ├── useDrawing.js        # Tool state + pointer event logic
│   │   │   ├── useHistory.js        # Undo/redo via ImageData snapshots
│   │   │   ├── useCursor.js         # Remote cursor positions
│   │   │   ├── useNotes.js          # Sticky note state + socket sync
│   │   │   ├── useZoomPan.js        # Zoom + pan state and handlers
│   │   │   ├── useTextInput.js      # Floating text input state
│   │   │   ├── useKeyboardShortcuts.js  # Ctrl+Z / Ctrl+Y shortcuts
│   │   │   └── usePresence.js       # Connected user list state
│   │   ├── utils/               # Pure utility functions (no React)
│   │   │   ├── canvasUtils.js       # Screen ↔ canvas coordinate conversion
│   │   │   ├── drawingUtils.js      # ctx2d, drawShape, floodFill, applyDrawEvent
│   │   │   └── exportUtils.js       # Export board as PNG
│   │   └── constants.js         # All magic numbers, strings, and tool config
│   ├── index.html
│   └── package.json
├── server/
│   ├── server.js                # Node.js WebSocket server
│   └── package.json
├── Dockerfile                   # Multi-stage production build
├── docker-compose.yml           # Single-command local deployment
├── .dockerignore
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher
- (Optional) [Docker](https://www.docker.com/) for containerised deployment

---

### Running Locally (Development)

**1. Clone the repository**

```bash
git clone https://github.com/your-username/collab-whiteboard.git
cd collab-whiteboard
```

**2. Start the WebSocket server**

```bash
cd server
npm install
node server.js
# → WebSocket server running on port 3001
```

**3. Start the React client** (in a second terminal)

```bash
cd client
npm install
npm run dev
# → Local: http://localhost:5173
```

**4. Open the app**

Navigate to `http://localhost:5173` in your browser.  
Open a second tab or share the URL with someone on the same network to collaborate.

> **Note:** The WebSocket server URL is hardcoded to `ws://localhost:3001` in `useSocket.js`.  
> For LAN collaboration, replace `localhost` with your machine's local IP address (e.g. `ws://192.168.1.42:3001`) and make sure port 3001 is not blocked by your firewall.

---

### Running with Docker

**Build and start everything in one command:**

```bash
docker compose up --build
```

- React app → `http://localhost:3000`
- WebSocket server → `ws://localhost:3001`

**Stop:**

```bash
docker compose down
```

**Rebuild after code changes:**

```bash
docker compose up --build --force-recreate
```

---

## Usage

### Tools

| Tool        | Shortcut | Description                                        |
| ----------- | -------- | -------------------------------------------------- |
| ✏️ Pen      | —        | Freehand drawing                                   |
| 🧽 Eraser   | —        | Remove pixels (transparent erase)                  |
| ╱ Line      | —        | Drag to draw a straight line                       |
| ▭ Rectangle | —        | Drag to draw a rectangle                           |
| ○ Ellipse   | —        | Drag to draw an ellipse                            |
| T Text      | —        | Click to place a text input; Enter to commit       |
| 🪣 Fill     | —        | Flood-fill an enclosed area with the current color |
| 📝 Note     | —        | Click to place a sticky note                       |

### Keyboard Shortcuts

| Shortcut                       | Action                                                |
| ------------------------------ | ----------------------------------------------------- |
| `Ctrl+Z` / `Cmd+Z`             | Undo (synced — removes your last stroke for everyone) |
| `Ctrl+Y` / `Cmd+Y`             | Redo                                                  |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo (alternative)                                    |
| `Space` + drag                 | Pan the canvas                                        |
| `Escape`                       | Cancel current text input                             |
| `Enter` (in text input)        | Commit text to canvas                                 |
| `Shift+Enter` (in text input)  | Insert a new line                                     |

### Zoom & Pan

| Action              | Result                    |
| ------------------- | ------------------------- |
| Scroll wheel        | Zoom in/out toward cursor |
| Space + left drag   | Pan                       |
| Middle mouse + drag | Pan                       |
| Click "Reset" badge | Return to 100% zoom       |

---

## Architecture Notes

### Why two canvases?

The app uses a **main canvas** (white background, committed drawing) and a transparent **overlay canvas** stacked on top. All pointer events go to the overlay. Shape tool previews are drawn on the overlay while dragging — when the pointer is released, the shape is committed to the main canvas and the overlay is cleared. This prevents half-drawn shapes from appearing in the saved state or being broadcast to other users.

### Collaborative undo

Local undo uses `ImageData` snapshots (fast, works offline). After each undo, the client also sends an `undo_last` message to the server containing the user's `userId`. The server removes that user's most recent stroke from the room's stroke list, then broadcasts a full `init` to every client — so all canvases resync from the authoritative server state.

### Stale closure prevention

WebSocket `onmessage` handlers are registered once and would normally capture stale closures. This is solved by storing the latest `onMessage` callback in a ref (`onMessageRef.current = onMessage`) that is updated synchronously during every render — so the handler always calls the freshest version without ever recreating the socket.

### socketRef passed at call time

All socket sends in hooks (`useNotes`, `useDrawing`) accept `socketRef` as a parameter at call time rather than storing it at hook initialisation. This means they always use the live socket reference from the current render, avoiding stale-ref bugs from React Strict Mode's double-mount behaviour.

---

## Environment Variables

| Variable   | Default       | Description                          |
| ---------- | ------------- | ------------------------------------ |
| `WS_PORT`  | `3001`        | Port the WebSocket server listens on |
| `NODE_ENV` | `development` | Set to `production` in Docker        |

---

## Known Limitations

- **In-memory state only** — restarting the server clears all boards. For persistence across restarts, a database (e.g. Redis, SQLite) would be needed.
- **No authentication** — anyone who knows the room URL can join and draw.
- **Single server** — horizontal scaling would require a shared pub/sub layer (e.g. Redis) to sync messages across server instances.
- **Undo is per-user** — undoing only removes your own last stroke, not other users' strokes.

---

## License

MIT — do whatever you like with it.

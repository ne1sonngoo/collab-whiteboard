/**
 * Canvas.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The top-level board component. Its sole responsibility is orchestration:
 * wiring hooks together, routing pointer events to the right handler, and
 * rendering the sub-components. No drawing logic lives here.
 *
 * Component tree rendered by this file:
 *   <Toolbar>          — fixed top-center: tool/color/size controls
 *   <RoomTitle>        — fixed below toolbar: editable board name
 *   <PresenceList>     — fixed top-right: connected user avatars
 *   <div containerRef> — clipping viewport for the zoomable board
 *     <div transform>  — single CSS transform target (translate + scale)
 *       <canvas main>  — committed drawing pixels (white background)
 *       <canvas overlay> — transparent; shape previews + receives all pointer events
 *       <TextInputOverlay> — floating textarea for the Text tool
 *       {notes}        — StickyNote components positioned as % of canvas size
 *       <RemoteCursors>  — other users' cursor dots + name labels
 *     </div>
 *   </div>
 *   <ZoomBadge>        — bottom-right: zoom% indicator + reset button
 */
import { useRef, useState, useEffect } from "react";
import { CANVAS_W, CANVAS_H, MSG, PRESENCE_COLORS } from "../constants";
import { ctx2d } from "../utils/drawingUtils";
import { exportBoardAsPng } from "../utils/exportUtils";
import { getCanvasCoords } from "../utils/canvasUtils";

// ── Hooks ─────────────────────────────────────────────────────────────────────
import useSocket            from "../hooks/useSocket";
import useDrawing           from "../hooks/useDrawing";
import useCursor            from "../hooks/useCursor";
import useNotes             from "../hooks/useNotes";
import useZoomPan           from "../hooks/useZoomPan";
import useTextInput         from "../hooks/useTextInput";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import usePresence          from "../hooks/usePresence";

// ── Components ────────────────────────────────────────────────────────────────
import Toolbar          from "./Toolbar";
import StickyNote       from "./StickyNote";
import RemoteCursors    from "./RemoteCursors";
import TextInputOverlay from "./TextInputOverlay";
import ZoomBadge        from "./ZoomBadge";
import RoomTitle        from "./RoomTitle";
import PresenceList     from "./PresenceList";

// ── Stable user identity ──────────────────────────────────────────────────────
/**
 * Generate a userId that persists for this browser session (cleared on tab close).
 * sessionStorage is per-tab so two tabs get different IDs even in the same browser.
 */
function getOrCreateUserId() {
  let id = sessionStorage.getItem("wb_userId");
  if (!id) {
    id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem("wb_userId", id);
  }
  return id;
}
const USER_ID = getOrCreateUserId();

/**
 * Assign a deterministic color to this user based on their userId.
 * Same userId always gets the same color across sessions.
 */
function colorForUser(userId) {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}
const USER_COLOR = colorForUser(USER_ID);

// ── Cursor throttle ───────────────────────────────────────────────────────────
// Cursor moves fire on every pixel of mouse movement — at 60 fps that can be
// thousands of WebSocket messages per second. We throttle to MAX 30 per second
// (one per 33 ms) to dramatically reduce server load and network traffic
// with no visible difference to the user.
const CURSOR_THROTTLE_MS = 33; // ~30 fps

// ─────────────────────────────────────────────────────────────────────────────

export default function Canvas({ boardId }) {
  // ── DOM refs ───────────────────────────────────────────────────────────────
  const canvasRef    = useRef(null); // main drawing canvas
  const overlayRef   = useRef(null); // transparent overlay: shape previews + pointer events
  const containerRef = useRef(null); // outer clip container for zoom/pan

  // Forward-declared socket ref so undo/redo callbacks (defined below) can close over it
  const socketRef = useRef(null);

  // Tracks the timestamp of the last cursor_move message sent.
  // Used to throttle outgoing cursor broadcasts.
  const lastCursorSendRef = useRef(0);

  // ── Room name ──────────────────────────────────────────────────────────────
  const [roomName, setRoomName] = useState("");

  // Keep the browser tab title in sync with the room name
  useEffect(() => {
    document.title = roomName ? `${roomName} — Whiteboard` : "Whiteboard";
  }, [roomName]);

  // ── Undo / redo → server sync ─────────────────────────────────────────────
  /**
   * handleUndoSync — after a local undo, tell the server to pop our last stroke.
   * Server removes it from the room's stroke list, pushes it to our redo stack,
   * then broadcasts a full init so all clients resync.
   */
  const handleUndoSync = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: MSG.UNDO_LAST, userId: USER_ID }));
  };

  /**
   * handleRedoSync — after a local redo, tell the server to restore our last
   * undone stroke. Server pops from our redo stack back into the stroke list,
   * then broadcasts a full init so all clients resync.
   */
  const handleRedoSync = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: MSG.REDO_LAST, userId: USER_ID }));
  };

  // ── Drawing ────────────────────────────────────────────────────────────────
  const {
    handleMouseMove: drawMouseMove,
    handleShapeStart, handleShapeEnd,
    commitText, handleFill,
    drawRemote, saveSnapshot,
    undo, redo, canUndo, canRedo,
    color, setColor, size, setSize, tool, setTool,
    isShapeTool, isTextTool, isFillTool,
  } = useDrawing(canvasRef, overlayRef, {
    userId:  USER_ID,
    onUndo:  handleUndoSync,
    onRedo:  handleRedoSync, // wire redo sync so all clients repaint after redo
  });

  // ── Cursors ────────────────────────────────────────────────────────────────
  const { cursors, updateCursor } = useCursor();

  // ── Notes ──────────────────────────────────────────────────────────────────
  const { notes, createNote, moveNote, updateNoteText, deleteNote, applyRemoteNote, initNotes } =
    useNotes();

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  const { zoom, resetZoom, startPanIfNeeded, continuePanIfActive, endPan, isSpaceDown } =
    useZoomPan(containerRef);

  // ── Text tool input ────────────────────────────────────────────────────────
  const textInputHook = useTextInput(({ cx, cy, value }) => {
    saveSnapshot(); // snapshot before commit so text can be undone
    commitText(cx, cy, value, socketRef);
  });

  // ── Username ───────────────────────────────────────────────────────────────
  const [username, setUsername] = useState(() =>
    localStorage.getItem("drawing_username") || "User-" + Math.floor(Math.random() * 10000)
  );

  // ── Presence ───────────────────────────────────────────────────────────────
  const { users: presenceUsers, applyPresenceUpdate } = usePresence();

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts({ undo, redo });

  // ── Canvas helpers ─────────────────────────────────────────────────────────
  /** Wipe all pixels from the main canvas (local only — not broadcast). */
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) ctx2d(c).clearRect(0, 0, c.width, c.height);
  };

  // ── Socket message handler ─────────────────────────────────────────────────
  /**
   * handleSocketMessage — the single entry point for all incoming WebSocket messages.
   * Each case maps to a MSG constant defined in constants.js.
   * Not wrapped in useCallback — useSocket stores it in a ref and updates that
   * ref synchronously each render, so it always calls the latest version.
   */
  function handleSocketMessage(data) {
    switch (data.type) {
      case MSG.INIT:
        // Full board resync — happens on join, after undo, and after redo.
        clearCanvas();
        (data.strokes || []).forEach((s) => drawRemote(canvasRef, s));
        initNotes(data.notes || []);
        break;
      case MSG.DRAW:
        drawRemote(canvasRef, data);
        break;
      case MSG.CURSOR_MOVE:
        updateCursor(data.userId, data.x, data.y, data.username);
        break;
      case MSG.CLEAR_BOARD:
        clearCanvas();
        break;
      case MSG.NOTE_CREATE:
      case MSG.NOTE_MOVE:
      case MSG.NOTE_UPDATE:
      case MSG.NOTE_DELETE:
        applyRemoteNote(data);
        break;
      case MSG.ROOM_INFO:
        setRoomName(data.name || "");
        break;
      case MSG.ROOM_RENAME:
        setRoomName(data.name || "");
        break;
      case MSG.PRESENCE_UPDATE:
        applyPresenceUpdate(data);
        break;
      default:
        break;
    }
  }

  // useSocket opens the WebSocket, sends "join" with our identity, and routes
  // all incoming messages through handleSocketMessage via a ref.
  const _socketRef = useSocket(boardId, handleSocketMessage, {
    userId:   USER_ID,
    username,
    color:    USER_COLOR,
  });

  // Mirror into the forward-declared ref so undo/redo callbacks always see the live socket
  socketRef.current = _socketRef.current;

  /** send — convenience wrapper: JSON-stringify and send if socket is open. */
  const send = (data) => {
    if (_socketRef.current?.readyState === WebSocket.OPEN)
      _socketRef.current.send(JSON.stringify(data));
  };

  /** handleRename — called by RoomTitle when the user submits a new board name. */
  const handleRename = (name) => send({ type: MSG.ROOM_RENAME, name });

  // ── Pointer event routing ─────────────────────────────────────────────────
  /**
   * handlePointerDown — routes the pointer-down event to the correct tool handler.
   * Pan is checked first since it can be activated regardless of the active tool.
   */
  const handlePointerDown = (e) => {
    if (startPanIfNeeded(e)) return; // space+drag or middle-mouse → pan

    const { x, y } = getCanvasCoords(e, canvasRef.current);

    if (isTextTool) {
      // Text tool: open a floating textarea at the clicked canvas position
      textInputHook.open(x, y);
      return;
    }
    if (isFillTool) {
      // Fill: snapshot first so the fill can be undone, then flood-fill
      saveSnapshot();
      handleFill(x, y, _socketRef);
      return;
    }
    if (tool === "note") {
      // Note tool: create a sticky note, passing userId so it's stored on the note
      createNote(x, y, _socketRef, USER_ID);
      return;
    }

    // All other tools (pen, eraser, shapes): snapshot before drawing for undo support
    saveSnapshot();
    if (isShapeTool) handleShapeStart(e); // record drag origin for shape tools
  };

  /**
   * handlePointerMove — routes move events to pan or draw handlers.
   * Also broadcasts cursor position, throttled to ~30 fps to reduce server load.
   */
  const handlePointerMove = (e) => {
    if (continuePanIfActive(e)) return; // currently panning — skip drawing
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoords(e, canvasRef.current);

    // Throttle cursor broadcasts: only send if enough time has passed since the last one.
    // Without throttling this fires on every pixel of mouse movement (hundreds/sec).
    const now = Date.now();
    if (now - lastCursorSendRef.current >= CURSOR_THROTTLE_MS) {
      send({ type: MSG.CURSOR_MOVE, x, y, username });
      lastCursorSendRef.current = now; // update the timestamp of the last send
    }

    // Forward to drawing logic for tools that have move behavior
    if (!isTextTool && !isFillTool && tool !== "note") {
      drawMouseMove(e, _socketRef);
    }
  };

  /**
   * handlePointerUp — finalize shape drawings and end any active pan.
   */
  const handlePointerUp = (e) => {
    endPan(); // always call — harmless if not currently panning
    if (isShapeTool) handleShapeEnd(e, _socketRef); // commit shape to main canvas
  };

  // ── Cursor style ───────────────────────────────────────────────────────────
  const cursorStyle = isSpaceDown() ? "grab"
    : isFillTool      ? "cell"
    : isTextTool      ? "text"
    : tool === "note" ? "copy"
    : "crosshair";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={outerStyle}>

      {/* Fixed toolbar — always visible above the board */}
      <Toolbar
        tool={tool}
        setTool={(t) => { textInputHook.close(); setTool(t); }}
        color={color} setColor={setColor}
        size={size}   setSize={setSize}
        clearBoard={() => { saveSnapshot(); clearCanvas(); send({ type: MSG.CLEAR_BOARD }); }}
        saveImage={() => exportBoardAsPng(canvasRef.current, notes, boardId)}
        username={username}
        setUsername={(n) => { setUsername(n); localStorage.setItem("drawing_username", n); }}
        undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
      />

      {/* Editable room name — centered below the toolbar */}
      <RoomTitle name={roomName} onChange={handleRename} />

      {/* Connected user avatars — top-right corner */}
      <PresenceList users={presenceUsers} myUserId={USER_ID} />

      {/* Clipping viewport — overflow:hidden prevents content escaping during zoom/pan */}
      <div ref={containerRef} style={containerStyle}>

        {/* Single CSS transform target — translate + scale applied here moves everything */}
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          transform: `translate(${zoom.panX}px,${zoom.panY}px) scale(${zoom.scale})`,
          transformOrigin: "0 0",
        }}>
          {/* Main canvas — all committed drawing lives here */}
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={mainCanvasStyle} />

          {/* Overlay canvas — transparent; receives pointer events and shows shape previews */}
          <canvas
            ref={overlayRef}
            width={CANVAS_W} height={CANVAS_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ ...overlayStyle, cursor: cursorStyle }}
          />

          {/* Floating text input — appears at click position when Text tool is active */}
          <TextInputOverlay
            textInput={textInputHook.textInput}
            textareaRef={textInputHook.textareaRef}
            scale={zoom.scale}
            color={color} size={size}
            onChange={textInputHook.handleChange}
            onKeyDown={textInputHook.handleKeyDown}
            onBlur={textInputHook.commit}
          />

          {/* Sticky notes — positioned as % of canvas size so they scale with zoom */}
          {notes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              posLeft={`${(note.x / CANVAS_W) * 100}%`}
              posTop={`${(note.y  / CANVAS_H) * 100}%`}
              onMove={(id, x, y) => moveNote(id, x, y, _socketRef)}
              onTextChange={(id, text) => updateNoteText(id, text, _socketRef)}
              onDelete={(id) => deleteNote(id, _socketRef)}
              canvasRef={canvasRef}
            />
          ))}

          {/* Remote cursors — other users' positions as colored dots with name labels */}
          <RemoteCursors cursors={cursors} scale={zoom.scale} />
        </div>

        {/* Zoom indicator — only shown when zoom !== 100% */}
        <ZoomBadge scale={zoom.scale} onReset={resetZoom} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

// Outer wrapper — centers the board horizontally; marginTop makes room for
// the fixed toolbar (≈50px) + RoomTitle (≈30px) + some breathing room
const outerStyle = { display: "flex", justifyContent: "center", marginTop: 100 };

// Clipping container — the visible viewport; overflow:hidden clips pan/zoom content
const containerStyle = {
  width: "95vw", height: "78vh",
  border: "2px solid black",
  background: "#f0f0f0", // grey visible outside the white canvas when zoomed out
  position: "relative",
  overflow: "hidden",
};

// Base styles shared by both canvas elements
const canvasBase = { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 };

// Main canvas — white background provides the actual drawing surface
const mainCanvasStyle = { ...canvasBase, background: "white", zIndex: 1 };

// Overlay canvas — transparent so main canvas shows through;
// sits above (zIndex 2) to receive all pointer events
const overlayStyle = { ...canvasBase, background: "transparent", zIndex: 2 };
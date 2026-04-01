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
 * Used to:
 *   • Attribute draw events to the correct user for targeted undo
 *   • Identify the current user in the presence list
 * sessionStorage is per-tab, so two tabs of the same browser get different IDs.
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
 * Assign a color to this user based on their userId.
 * Same userId always gets the same color (deterministic hash).
 */
function colorForUser(userId) {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}
const USER_COLOR = colorForUser(USER_ID);

// ─────────────────────────────────────────────────────────────────────────────

export default function Canvas({ boardId }) {
  // ── DOM refs ───────────────────────────────────────────────────────────────
  const canvasRef    = useRef(null); // main drawing canvas
  const overlayRef   = useRef(null); // transparent overlay: shape previews + pointer events
  const containerRef = useRef(null); // outer clip container for zoom/pan

  // Forward-declared socket ref so the undo callback (defined below) can close over it
  const socketRef = useRef(null);

  // ── Room name ──────────────────────────────────────────────────────────────
  const [roomName, setRoomName] = useState("");

  // Keep the browser tab title in sync with the room name
  useEffect(() => {
    document.title = roomName ? `${roomName} — Whiteboard` : "Whiteboard";
  }, [roomName]);

  // ── Undo → server sync ────────────────────────────────────────────────────
  /**
   * After a local undo, tell the server to pop our last stroke from the room's
   * stroke list. The server then broadcasts a full `init` to all clients so
   * every canvas repaints from the updated authoritative state.
   */
  const handleUndoSync = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: MSG.UNDO_LAST, userId: USER_ID }));
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
  } = useDrawing(canvasRef, overlayRef, { userId: USER_ID, onUndo: handleUndoSync });

  // ── Cursors ────────────────────────────────────────────────────────────────
  const { cursors, updateCursor } = useCursor();

  // ── Notes ──────────────────────────────────────────────────────────────────
  const { notes, createNote, moveNote, updateNoteText, deleteNote, applyRemoteNote, initNotes } =
    useNotes();

  // ── Zoom / pan ─────────────────────────────────────────────────────────────
  const { zoom, resetZoom, startPanIfNeeded, continuePanIfActive, endPan, isSpaceDown } =
    useZoomPan(containerRef);

  // ── Text tool input ────────────────────────────────────────────────────────
  // onCommit is called when the user presses Enter or clicks away
  const textInputHook = useTextInput(({ cx, cy, value }) => {
    saveSnapshot(); // save before committing so the text can be undone
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
   * Each case maps to a MSG constant from constants.js.
   *
   * This function is intentionally NOT wrapped in useCallback.
   * useSocket stores it in a ref (onMessageRef) and updates that ref
   * synchronously each render, so it always calls the latest version.
   */
  function handleSocketMessage(data) {
    switch (data.type) {

      case MSG.INIT:
        // Full board resync — happens on join and after any undo.
        // Clear canvas first, then replay all stored strokes in order.
        clearCanvas();
        (data.strokes || []).forEach((s) => drawRemote(canvasRef, s));
        initNotes(data.notes || []); // replace local notes with server's authoritative list
        break;

      case MSG.DRAW:
        // A single draw event from another user — replay it on our canvas
        drawRemote(canvasRef, data);
        break;

      case MSG.CURSOR_MOVE:
        // Update the stored position for another user's cursor dot
        updateCursor(data.userId, data.x, data.y, data.username);
        break;

      case MSG.CLEAR_BOARD:
        // Another user (or ourselves) cleared the board
        clearCanvas();
        break;

      case MSG.NOTE_CREATE:
      case MSG.NOTE_MOVE:
      case MSG.NOTE_UPDATE:
      case MSG.NOTE_DELETE:
        // All note mutations funnel through applyRemoteNote
        applyRemoteNote(data);
        break;

      case MSG.ROOM_INFO:
        // Server sends this once on join with the current room name
        setRoomName(data.name || "");
        break;

      case MSG.ROOM_RENAME:
        // Another user (or ourselves) renamed the room
        setRoomName(data.name || "");
        break;

      case MSG.PRESENCE_UPDATE:
        // Server sends this whenever someone joins or leaves the room
        applyPresenceUpdate(data);
        break;

      default:
        break;
    }
  }

  // useSocket opens the WebSocket, sends "join", and routes incoming messages
  // via handleSocketMessage. It also passes our identity to the server for presence.
  const _socketRef = useSocket(boardId, handleSocketMessage, {
    userId:   USER_ID,
    username,
    color:    USER_COLOR,
  });

  // Mirror the socket ref so handleUndoSync and any callback can always see the live socket
  socketRef.current = _socketRef.current;

  /** send — convenience wrapper to JSON-stringify and send if socket is open. */
  const send = (data) => {
    if (_socketRef.current?.readyState === WebSocket.OPEN)
      _socketRef.current.send(JSON.stringify(data));
  };

  /** handleRename — called by RoomTitle when the user submits a new name. */
  const handleRename = (name) => send({ type: MSG.ROOM_RENAME, name });

  // ── Pointer event routing ─────────────────────────────────────────────────
  /**
   * handlePointerDown — routes the pointer-down event to the correct tool handler.
   * Order matters: pan check first, then tool-specific logic.
   */
  const handlePointerDown = (e) => {
    // Space+drag or middle-mouse → pan (handled entirely by useZoomPan)
    if (startPanIfNeeded(e)) return;

    // Convert screen coords to canvas pixel coords
    const { x, y } = getCanvasCoords(e, canvasRef.current);

    if (isTextTool) {
      // Text tool: open a floating textarea at the clicked canvas position
      textInputHook.open(x, y);
      return;
    }
    if (isFillTool) {
      // Fill tool: flood-fill from click point (snapshot first for undo)
      saveSnapshot();
      handleFill(x, y, _socketRef);
      return;
    }
    if (tool === "note") {
      // Note tool: create a new sticky note at click position
      createNote(x, y, _socketRef);
      return;
    }

    // All other tools: save a snapshot before drawing begins (enables undo)
    saveSnapshot();
    if (isShapeTool) handleShapeStart(e); // record drag origin for shapes
    // Pen/eraser: first move event will begin drawing (handleMouseMove)
  };

  /**
   * handlePointerMove — routes move events to pan or draw handlers.
   * Also broadcasts cursor position so other clients see our cursor.
   */
  const handlePointerMove = (e) => {
    // If panning, let useZoomPan handle it and skip everything else
    if (continuePanIfActive(e)) return;
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoords(e, canvasRef.current);

    // Broadcast our cursor position to other clients (regardless of tool)
    send({ type: MSG.CURSOR_MOVE, x, y, username });

    // Draw for pen/eraser/shapes — text, fill, and notes have no move behavior
    if (!isTextTool && !isFillTool && tool !== "note") {
      drawMouseMove(e, _socketRef);
    }
  };

  /**
   * handlePointerUp — finalize shape drawings and end pan.
   */
  const handlePointerUp = (e) => {
    endPan(); // always call — harmless if not panning
    if (isShapeTool) handleShapeEnd(e, _socketRef); // commit shape to canvas
  };

  // ── Cursor style ───────────────────────────────────────────────────────────
  // The overlay canvas cursor changes to give visual feedback for the active tool
  const cursorStyle = isSpaceDown() ? "grab"       // space = pan mode
    : isFillTool      ? "cell"                     // fill = crosshair+dot
    : isTextTool      ? "text"                     // text = I-beam
    : tool === "note" ? "copy"                     // note = copy/add cursor
    : "crosshair";                                 // pen/eraser/shapes = crosshair

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={outerStyle}>

      {/* Fixed toolbar — always visible above the board */}
      <Toolbar
        tool={tool}
        setTool={(t) => { textInputHook.close(); setTool(t); }} // close text input on tool switch
        color={color} setColor={setColor}
        size={size}   setSize={setSize}
        clearBoard={() => { saveSnapshot(); clearCanvas(); send({ type: MSG.CLEAR_BOARD }); }}
        saveImage={() => exportBoardAsPng(canvasRef.current, notes, boardId)}
        username={username}
        setUsername={(n) => { setUsername(n); localStorage.setItem("drawing_username", n); }}
        undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
      />

      {/* Editable room name — sits below the toolbar */}
      <RoomTitle name={roomName} onChange={handleRename} />

      {/* Connected user avatars — top-right corner */}
      <PresenceList users={presenceUsers} myUserId={USER_ID} />

      {/* Clipping viewport — overflow hidden prevents content escaping during pan/zoom */}
      <div ref={containerRef} style={containerStyle}>

        {/* Single transform target — CSS translate+scale applied here moves everything inside */}
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          transform: `translate(${zoom.panX}px,${zoom.panY}px) scale(${zoom.scale})`,
          transformOrigin: "0 0", // zoom from top-left so coordinates are predictable
        }}>

          {/* Main canvas — all committed drawing lives here */}
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={mainCanvasStyle} />

          {/* Overlay canvas — transparent; receives all pointer events and shows shape previews */}
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

          {/* Sticky notes — positioned as % of canvas size so they stay with the drawing */}
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

// Outer wrapper — centers the board below the fixed toolbar + title
const outerStyle = { display: "flex", justifyContent: "center", marginTop: 100 };

// Clipping container — defines the visible viewport for the board
const containerStyle = {
  width: "95vw", height: "78vh",
  border: "2px solid black",
  background: "#f0f0f0", // grey shows outside the white canvas when zoomed out
  position: "relative",
  overflow: "hidden",    // clips panned/zoomed content at the border
};

// Shared base for both canvas elements
const canvasBase = { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 };

// Main canvas — white background provides the drawing surface
const mainCanvasStyle = { ...canvasBase, background: "white", zIndex: 1 };

// Overlay canvas — transparent so the main canvas shows through;
// sits above main (zIndex 2) to receive all pointer events
const overlayStyle = { ...canvasBase, background: "transparent", zIndex: 2 };
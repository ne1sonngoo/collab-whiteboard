/**
 * Canvas.jsx
 * Top-level board component. Pure orchestration — no drawing logic here.
 */
import { useRef, useState, useEffect } from "react";
import { CANVAS_W, CANVAS_H, MSG } from "../constants";
import { ctx2d } from "../utils/drawingUtils";
import { exportBoardAsPng } from "../utils/exportUtils";
import { getCanvasCoords } from "../utils/canvasUtils";

import useSocket            from "../hooks/useSocket";
import useDrawing           from "../hooks/useDrawing";
import useCursor            from "../hooks/useCursor";
import useNotes             from "../hooks/useNotes";
import useZoomPan           from "../hooks/useZoomPan";
import useTextInput         from "../hooks/useTextInput";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";

import Toolbar          from "./Toolbar";
import StickyNote       from "./StickyNote";
import RemoteCursors    from "./RemoteCursors";
import TextInputOverlay from "./TextInputOverlay";
import ZoomBadge        from "./ZoomBadge";
import RoomTitle        from "./RoomTitle";

function getOrCreateUserId() {
  let id = sessionStorage.getItem("wb_userId");
  if (!id) {
    id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem("wb_userId", id);
  }
  return id;
}
const USER_ID = getOrCreateUserId();

export default function Canvas({ boardId }) {
  const canvasRef    = useRef(null);
  const overlayRef   = useRef(null);
  const containerRef = useRef(null);
  const socketRef    = useRef(null);

  // ── Room name ─────────────────────────────────────────────────────────────
  const [roomName, setRoomName] = useState("");

  // Keep browser tab title in sync
  useEffect(() => {
    document.title = roomName ? `${roomName} — Whiteboard` : "Whiteboard";
  }, [roomName]);

  // ── Undo sync ─────────────────────────────────────────────────────────────
  const handleUndoSync = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: MSG.UNDO_LAST, userId: USER_ID }));
  };

  // ── Drawing / notes / zoom / text hooks ──────────────────────────────────
  const {
    handleMouseMove: drawMouseMove, handleShapeStart, handleShapeEnd,
    commitText, handleFill, drawRemote, saveSnapshot,
    undo, redo, canUndo, canRedo,
    color, setColor, size, setSize, tool, setTool,
    isShapeTool, isTextTool, isFillTool,
  } = useDrawing(canvasRef, overlayRef, { userId: USER_ID, onUndo: handleUndoSync });

  const { cursors, updateCursor } = useCursor();
  const { notes, createNote, moveNote, updateNoteText, deleteNote, applyRemoteNote, initNotes } =
    useNotes();

  const { zoom, resetZoom, startPanIfNeeded, continuePanIfActive, endPan, isSpaceDown } =
    useZoomPan(containerRef);

  const textInputHook = useTextInput(({ cx, cy, value }) => {
    saveSnapshot();
    commitText(cx, cy, value, socketRef);
  });

  const [username, setUsername] = useState(() =>
    localStorage.getItem("drawing_username") || "User-" + Math.floor(Math.random() * 10000)
  );

  useKeyboardShortcuts({ undo, redo });

  // ── Canvas helpers ────────────────────────────────────────────────────────
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) ctx2d(c).clearRect(0, 0, c.width, c.height);
  };

  // ── Socket ────────────────────────────────────────────────────────────────
  function handleSocketMessage(data) {
    switch (data.type) {
      case MSG.INIT:
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
      case MSG.ROOM_RENAME:
        setRoomName(data.name || "");
        break;
      default:
        break;
    }
  }

  const _socketRef = useSocket(boardId, handleSocketMessage);
  // Mirror into the forward-declared ref so callbacks always see the live socket
  socketRef.current = _socketRef.current;

  const send = (data) => {
    if (_socketRef.current?.readyState === WebSocket.OPEN)
      _socketRef.current.send(JSON.stringify(data));
  };

  const handleRename = (name) => {
    send({ type: MSG.ROOM_RENAME, name });
  };

  // ── Pointer routing ───────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (startPanIfNeeded(e)) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    if (isTextTool)      { textInputHook.open(x, y); return; }
    if (isFillTool)      { saveSnapshot(); handleFill(x, y, _socketRef); return; }
    if (tool === "note") { createNote(x, y, _socketRef); return; }
    saveSnapshot();
    if (isShapeTool) handleShapeStart(e);
  };

  const handlePointerMove = (e) => {
    if (continuePanIfActive(e)) return;
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    send({ type: MSG.CURSOR_MOVE, x, y, username });
    if (!isTextTool && !isFillTool && tool !== "note") drawMouseMove(e, _socketRef);
  };

  const handlePointerUp = (e) => {
    endPan();
    if (isShapeTool) handleShapeEnd(e, _socketRef);
  };

  // ── Cursor style ──────────────────────────────────────────────────────────
  const cursorStyle = isSpaceDown() ? "grab"
    : isFillTool      ? "cell"
    : isTextTool      ? "text"
    : tool === "note" ? "copy"
    : "crosshair";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={outerStyle}>
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

      <RoomTitle name={roomName} onChange={handleRename} />

      <div ref={containerRef} style={containerStyle}>
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          transform: `translate(${zoom.panX}px,${zoom.panY}px) scale(${zoom.scale})`,
          transformOrigin: "0 0",
        }}>
          <canvas ref={canvasRef}  width={CANVAS_W} height={CANVAS_H} style={mainCanvasStyle} />
          <canvas
            ref={overlayRef}
            width={CANVAS_W} height={CANVAS_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ ...overlayStyle, cursor: cursorStyle }}
          />

          <TextInputOverlay
            textInput={textInputHook.textInput}
            textareaRef={textInputHook.textareaRef}
            scale={zoom.scale}
            color={color} size={size}
            onChange={textInputHook.handleChange}
            onKeyDown={textInputHook.handleKeyDown}
            onBlur={textInputHook.commit}
          />

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

          <RemoteCursors cursors={cursors} scale={zoom.scale} />
        </div>

        <ZoomBadge scale={zoom.scale} onReset={resetZoom} />
      </div>
    </div>
  );
}

const outerStyle      = { display: "flex", justifyContent: "center", marginTop: 100 };
const containerStyle  = { width: "95vw", height: "78vh", border: "2px solid black", background: "#f0f0f0", position: "relative", overflow: "hidden" };
const canvasBase      = { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 };
const mainCanvasStyle = { ...canvasBase, background: "white", zIndex: 1 };
const overlayStyle    = { ...canvasBase, background: "transparent", zIndex: 2 };
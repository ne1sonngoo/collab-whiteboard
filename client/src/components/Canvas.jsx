/**
 * Canvas.jsx
 * Top-level board component. Orchestrates hooks and sub-components.
 * Contains no drawing logic — that lives in hooks and utils.
 */
import { useRef, useState } from "react";
import { CANVAS_W, CANVAS_H, MSG } from "../constants";
import { ctx2d } from "../utils/drawingUtils";
import { exportBoardAsPng } from "../utils/exportUtils";
import { getCanvasCoords } from "../utils/canvasUtils";

import useSocket   from "../hooks/useSocket";
import useDrawing  from "../hooks/useDrawing";
import useCursor   from "../hooks/useCursor";
import useNotes    from "../hooks/useNotes";
import useZoomPan  from "../hooks/useZoomPan";
import useTextInput from "../hooks/useTextInput";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";

import Toolbar           from "./Toolbar";
import StickyNote        from "./StickyNote";
import RemoteCursors     from "./RemoteCursors";
import TextInputOverlay  from "./TextInputOverlay";
import ZoomBadge         from "./ZoomBadge";

export default function Canvas({ boardId }) {
  const canvasRef    = useRef(null);
  const overlayRef   = useRef(null);
  const containerRef = useRef(null);

  // ── Hooks ─────────────────────────────────────────────────────────────────
  const {
    handleMouseMove: drawMouseMove, handleShapeStart, handleShapeEnd,
    commitText, handleFill, drawRemote, saveSnapshot,
    undo, redo, canUndo, canRedo,
    color, setColor, size, setSize, tool, setTool,
    isShapeTool, isTextTool, isFillTool,
  } = useDrawing(canvasRef, overlayRef);

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
      case MSG.DRAW:         drawRemote(canvasRef, data);                           break;
      case MSG.CURSOR_MOVE:  updateCursor(data.userId, data.x, data.y, data.username); break;
      case MSG.CLEAR_BOARD:  clearCanvas();                                         break;
      case MSG.NOTE_CREATE:
      case MSG.NOTE_MOVE:
      case MSG.NOTE_UPDATE:  applyRemoteNote(data);                                 break;
      default:               break;
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

  const send = (data) => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify(data));
  };

  // ── Pointer routing ───────────────────────────────────────────────────────
  const handlePointerDown = (e) => {
    if (startPanIfNeeded(e)) return;

    const { x, y } = getCanvasCoords(e, canvasRef.current);

    if (isTextTool)       { textInputHook.open(x, y); return; }
    if (isFillTool)       { saveSnapshot(); handleFill(x, y, socketRef); return; }
    if (tool === "note")  { createNote(x, y, socketRef); return; }

    saveSnapshot();
    if (isShapeTool) handleShapeStart(e);
  };

  const handlePointerMove = (e) => {
    if (continuePanIfActive(e)) return;
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    send({ type: MSG.CURSOR_MOVE, x, y, username });
    if (!isTextTool && !isFillTool && tool !== "note") drawMouseMove(e, socketRef);
  };

  const handlePointerUp = (e) => {
    endPan();
    if (isShapeTool) handleShapeEnd(e, socketRef);
  };

  // ── Cursor style ──────────────────────────────────────────────────────────
  const cursorStyle = isSpaceDown() ? "grab"
    : isFillTool    ? "cell"
    : isTextTool    ? "text"
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

      <div ref={containerRef} style={containerStyle}>
        {/* Single transform wrapper — everything inside moves together */}
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
              onMove={(id, x, y) => moveNote(id, x, y, socketRef)}
              onTextChange={(id, text) => updateNoteText(id, text, socketRef)}
              onDelete={deleteNote}
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

const outerStyle     = { display: "flex", justifyContent: "center", marginTop: 40 };
const containerStyle = { width: "95vw", height: "80vh", border: "2px solid black", background: "#f0f0f0", position: "relative", overflow: "hidden" };
const canvasBase     = { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 };
const mainCanvasStyle = { ...canvasBase, background: "white", zIndex: 1 };
const overlayStyle    = { ...canvasBase, background: "transparent", zIndex: 2 };
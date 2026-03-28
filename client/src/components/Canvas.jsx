import { useRef, useState, useEffect, useCallback } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing, { ctx2d } from "../hooks/useDrawing";
import useCursor from "../hooks/useCursor";
import useNotes from "../hooks/useNotes";
import Toolbar from "../components/Toolbar";
import StickyNote from "../components/StickyNote";
import { getCanvasCoords } from "../utils/canvasUtils";

export default function Canvas({ boardId }) {
  const canvasRef  = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);

  // ── Zoom / pan ──────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState({ scale: 1, panX: 0, panY: 0 });
  const zoomRef = useRef(zoom); // always-current copy for wheel handler closure
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const spaceDown = useRef(false);
  const panState  = useRef(null); // { startX, startY, startPanX, startPanY }

  // Wheel: zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { scale, panX, panY } = zoomRef.current;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.15, Math.min(8, scale * factor));
    setZoom({
      scale: newScale,
      panX: mx - (mx - panX) * (newScale / scale),
      panY: my - (my - panY) * (newScale / scale),
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Text input overlay ──────────────────────────────────────────────────
  const [textInput, setTextInput] = useState(null); // { cx, cy, value }
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textInput) textareaRef.current?.focus();
  }, [textInput]);

  // ── Drawing hook ────────────────────────────────────────────────────────
  const {
    handleMouseMove: drawMouseMove,
    handleShapeStart, handleShapeEnd,
    commitText, handleFill,
    drawRemote, saveSnapshot,
    undo, redo, canUndo, canRedo,
    color, setColor, size, setSize, tool, setTool,
    isShapeTool, isTextTool, isFillTool,
  } = useDrawing(canvasRef, overlayRef);

  const { cursors, updateCursor } = useCursor();
  const { notes, createNote, moveNote, updateNoteText, deleteNote, applyRemoteNote, initNotes } = useNotes();

  const [username, setUsername] = useState(() =>
    localStorage.getItem("drawing_username") || "User-" + Math.floor(Math.random() * 10000)
  );

  // ── Canvas helpers ──────────────────────────────────────────────────────
  const clearCanvas = () => {
    if (!canvasRef.current) return;
    ctx2d(canvasRef.current).clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // ── Socket ──────────────────────────────────────────────────────────────
  function handleSocketMessage(data) {
    switch (data.type) {
      case "init":
        clearCanvas();
        data.strokes.forEach((s) => drawRemote(canvasRef, s));
        initNotes(data.notes);
        break;
      case "draw":        drawRemote(canvasRef, data); break;
      case "cursor_move": updateCursor(data.userId, data.x, data.y, data.username); break;
      case "clear_board": clearCanvas(); break;
      case "note_create":
      case "note_move":
      case "note_update": applyRemoteNote(data); break;
      default: break;
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

  const send = (data) => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify(data));
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === "Space" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        spaceDown.current = true;
      }
      const mod = navigator.platform.toUpperCase().includes("MAC") ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((mod && e.key === "y") || (mod && e.shiftKey && e.key === "z")) { e.preventDefault(); redo(); }
    };
    const onUp = (e) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, [undo, redo]);

  // ── Pointer handlers (on the overlay canvas) ────────────────────────────
  const handlePointerDown = (e) => {
    // Middle mouse or space = pan
    if (e.button === 1 || spaceDown.current) {
      e.preventDefault();
      panState.current = {
        startX: e.clientX, startY: e.clientY,
        startPanX: zoomRef.current.panX, startPanY: zoomRef.current.panY,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const { x, y } = getCanvasCoords(e, canvasRef.current);

    if (isTextTool) {
      // Commit any existing text first
      if (textInput?.value?.trim()) {
        saveSnapshot();
        commitText(textInput.cx, textInput.cy, textInput.value, socketRef);
      }
      setTextInput({ cx: x, cy: y, value: "" });
      return;
    }
    if (isFillTool) {
      saveSnapshot();
      handleFill(x, y, socketRef);
      return;
    }
    if (tool === "note") {
      createNote(x, y, socketRef);
      return;
    }
    saveSnapshot();
    if (isShapeTool) handleShapeStart(e);
  };

  const handlePointerMove = (e) => {
    if (panState.current) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      setZoom((prev) => ({
        ...prev,
        panX: panState.current.startPanX + dx,
        panY: panState.current.startPanY + dy,
      }));
      return;
    }
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    send({ type: "cursor_move", x, y, username });
    if (!isTextTool && !isFillTool && tool !== "note") drawMouseMove(e, socketRef);
  };

  const handlePointerUp = (e) => {
    if (panState.current) { panState.current = null; return; }
    if (isShapeTool) handleShapeEnd(e, socketRef);
  };

  // ── Text input commit / cancel ──────────────────────────────────────────
  const commitCurrentText = () => {
    if (!textInput) return;
    if (textInput.value.trim()) {
      saveSnapshot();
      commitText(textInput.cx, textInput.cy, textInput.value, socketRef);
    }
    setTextInput(null);
  };

  const handleTextKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { setTextInput(null); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitCurrentText(); }
  };

  // ── Export: canvas + notes rendered onto offscreen canvas ───────────────
  const handleSaveImage = () => {
    if (!canvasRef.current) return;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    const off = document.createElement("canvas");
    off.width = cw; off.height = ch;
    const octx = off.getContext("2d");

    // White background
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, cw, ch);

    // Drawing
    octx.drawImage(canvasRef.current, 0, 0);

    // Notes (approximate canvas-space sizing)
    const noteW = Math.round(cw * 0.12); // ~12% of canvas width
    const noteH = Math.round(ch * 0.18);
    const fontSize = Math.round(noteW * 0.08);
    notes.forEach((note) => {
      octx.fillStyle = note.color;
      octx.fillRect(note.x, note.y, noteW, noteH);
      octx.strokeStyle = "rgba(0,0,0,0.15)";
      octx.lineWidth = 1;
      octx.strokeRect(note.x, note.y, noteW, noteH);
      octx.fillStyle = "#333";
      octx.font = `${fontSize}px sans-serif`;
      const lines = note.text.split("\n");
      lines.forEach((line, i) => {
        octx.fillText(line, note.x + 8, note.y + fontSize + 8 + i * fontSize * 1.4, noteW - 16);
      });
    });

    const a = document.createElement("a");
    a.download = `board-${boardId}.png`;
    a.href = off.toDataURL();
    a.click();
  };

  // ── Cursor style ────────────────────────────────────────────────────────
  const cursorStyle = spaceDown.current
    ? "grab"
    : isFillTool ? "cell"
    : isTextTool ? "text"
    : tool === "note" ? "copy"
    : "crosshair";

  // ── Text input positioning (% inside transform div) ─────────────────────
  const textLeft = textInput ? `${(textInput.cx / 1400) * 100}%` : 0;
  const textTop  = textInput ? `${(textInput.cy / 800)  * 100}%` : 0;
  const textFontSize = `${Math.max(12, size * 8) / zoom.scale}px`;

  return (
    <div style={outerStyle}>
      <Toolbar
        tool={tool} setTool={(t) => { setTextInput(null); setTool(t); }}
        color={color} setColor={setColor}
        size={size} setSize={setSize}
        clearBoard={() => { saveSnapshot(); clearCanvas(); send({ type: "clear_board" }); }}
        saveImage={handleSaveImage}
        username={username}
        setUsername={(n) => { setUsername(n); localStorage.setItem("drawing_username", n); }}
        undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
      />

      {/* Outer clip container */}
      <div ref={containerRef} style={containerStyle}>

        {/* Transform wrapper — everything inside scales/pans together */}
        <div style={{
          position: "absolute", width: "100%", height: "100%",
          transform: `translate(${zoom.panX}px, ${zoom.panY}px) scale(${zoom.scale})`,
          transformOrigin: "0 0",
        }}>
          {/* Main canvas */}
          <canvas ref={canvasRef} width={1400} height={800} style={mainCanvasStyle} />

          {/* Overlay: shape previews + pointer events */}
          <canvas
            ref={overlayRef}
            width={1400}
            height={800}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ ...overlayCanvasStyle, cursor: cursorStyle }}
          />

          {/* Text input (inside transform so it scales with zoom) */}
          {textInput && (
            <textarea
              ref={textareaRef}
              value={textInput.value}
              onChange={(e) => setTextInput((prev) => ({ ...prev, value: e.target.value }))}
              onKeyDown={handleTextKeyDown}
              onBlur={commitCurrentText}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: textLeft,
                top: textTop,
                minWidth: 120,
                minHeight: 40,
                background: "rgba(255,255,255,0.85)",
                border: "1.5px dashed #555",
                borderRadius: 3,
                outline: "none",
                padding: "4px 6px",
                fontSize: textFontSize,
                fontFamily: "sans-serif",
                color,
                resize: "both",
                zIndex: 30,
              }}
            />
          )}

          {/* Sticky notes (inside transform — positioned by % of canvas size) */}
          {notes.map((note) => (
            <StickyNote
              key={note.id}
              note={note}
              posLeft={`${(note.x / 1400) * 100}%`}
              posTop={`${(note.y / 800) * 100}%`}
              onMove={(id, x, y) => moveNote(id, x, y, socketRef)}
              onTextChange={(id, text) => updateNoteText(id, text, socketRef)}
              onDelete={deleteNote}
              canvasRef={canvasRef}
            />
          ))}

          {/* Remote cursors (inside transform — % positioning) */}
          {Object.entries(cursors).map(([id, cursor]) => (
            <div
              key={id}
              style={{
                position: "absolute",
                left: `${(cursor.x / 1400) * 100}%`,
                top:  `${(cursor.y / 800)  * 100}%`,
                pointerEvents: "none",
                zIndex: 5,
                // Counter-scale so cursor UI stays constant screen size
                transform: `scale(${1 / zoom.scale})`,
                transformOrigin: "0 0",
              }}
            >
              <div style={{ ...cursorDotStyle, background: cursor.color }} />
              <div style={cursorLabelStyle}>{cursor.username || "User"}</div>
            </div>
          ))}
        </div>

        {/* Zoom hint */}
        {zoom.scale !== 1 && (
          <div style={zoomBadgeStyle}>
            {Math.round(zoom.scale * 100)}%
            <button onClick={() => setZoom({ scale: 1, panX: 0, panY: 0 })} style={resetZoomBtn}>
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const outerStyle = { display: "flex", justifyContent: "center", marginTop: 40 };
const containerStyle = {
  width: "95vw", height: "80vh", border: "2px solid black",
  background: "#f0f0f0", position: "relative", overflow: "hidden",
};
const canvasBase = {
  width: "100%", height: "100%",
  position: "absolute", top: 0, left: 0,
};
const mainCanvasStyle = { ...canvasBase, background: "white", zIndex: 1 };
const overlayCanvasStyle = { ...canvasBase, background: "transparent", zIndex: 2 };
const cursorDotStyle = { width: 12, height: 12, borderRadius: "50%" };
const cursorLabelStyle = {
  position: "absolute", top: 14, left: 0, fontSize: 12,
  background: "black", color: "white", padding: "2px 6px",
  borderRadius: 6, whiteSpace: "nowrap",
};
const zoomBadgeStyle = {
  position: "absolute", bottom: 12, right: 12, zIndex: 100,
  background: "rgba(0,0,0,0.6)", color: "white",
  padding: "4px 10px", borderRadius: 20, fontSize: 13,
  display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto",
};
const resetZoomBtn = {
  background: "rgba(255,255,255,0.2)", border: "none", color: "white",
  cursor: "pointer", borderRadius: 10, padding: "2px 8px", fontSize: 12,
};
import { useRef, useState, useEffect } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useCursor from "../hooks/useCursor";
import useNotes from "../hooks/useNotes";
import Toolbar from "../components/Toolbar";
import StickyNote from "../components/StickyNote";
import { getCanvasCoords, toScreenCoords } from "../utils/canvasUtils";

const ctx2d = (canvas) => canvas.getContext("2d", { willReadFrequently: true });

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null); // transparent canvas for shape previews

  const { cursors, updateCursor } = useCursor();

  const {
    handleMouseMove: drawMouseMove,
    handleShapeStart,
    handleShapeEnd,
    drawRemote,
    saveSnapshot,
    undo, redo, canUndo, canRedo,
    color, setColor,
    size, setSize,
    tool, setTool,
    isShapeTool,
  } = useDrawing(canvasRef, overlayRef);

  const {
    notes, createNote, moveNote, updateNoteText, deleteNote,
    applyRemoteNote, initNotes,
  } = useNotes();

  const [username, setUsername] = useState(() =>
    localStorage.getItem("drawing_username") || "User-" + Math.floor(Math.random() * 10000)
  );

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    ctx2d(canvasRef.current).clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  function handleSocketMessage(data) {
    switch (data.type) {
      case "init":
        clearCanvas();
        data.strokes.forEach((s) => drawRemote(canvasRef, s));
        initNotes(data.notes);
        break;
      case "draw":
        drawRemote(canvasRef, data);
        break;
      case "cursor_move":
        updateCursor(data.userId, data.x, data.y, data.username);
        break;
      case "clear_board":
        clearCanvas();
        break;
      case "note_create":
      case "note_move":
      case "note_update":
        applyRemoteNote(data);
        break;
      default:
        break;
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

  useEffect(() => {
    const onKey = (e) => {
      const mod = navigator.platform.toUpperCase().includes("MAC") ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((mod && e.key === "y") || (mod && e.shiftKey && e.key === "z")) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const send = (data) => {
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify(data));
  };

  const clearBoard = () => {
    saveSnapshot();
    clearCanvas();
    send({ type: "clear_board" });
  };

  const handleSaveImage = () => {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.download = `drawing-${boardId}.png`;
    a.href = canvasRef.current.toDataURL();
    a.click();
  };

  const handlePointerDown = (e) => {
    if (tool === "note") {
      const { x, y } = getCanvasCoords(e, canvasRef.current);
      createNote(x, y, socketRef);
    } else if (isShapeTool) {
      saveSnapshot();
      handleShapeStart(e);
    } else {
      saveSnapshot();
    }
  };

  const handlePointerMove = (e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    send({ type: "cursor_move", x, y, username });
    if (tool !== "note") drawMouseMove(e, socketRef);
  };

  const handlePointerUp = (e) => {
    if (isShapeTool) handleShapeEnd(e, socketRef);
  };

  const cursorStyle = tool === "note" ? "cell" : isShapeTool ? "crosshair" : "crosshair";

  return (
    <div style={containerStyle}>
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        size={size} setSize={setSize}
        clearBoard={clearBoard}
        saveImage={handleSaveImage}
        username={username}
        setUsername={(n) => {
          setUsername(n);
          localStorage.setItem("drawing_username", n);
        }}
        undo={undo} redo={redo}
        canUndo={canUndo} canRedo={canRedo}
      />
      <div style={canvasContainerStyle}>
        {/* Main canvas — committed strokes live here */}
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          style={{ ...canvasStyle, zIndex: 1 }}
        />
        {/* Overlay canvas — shape previews only, cleared on every move */}
        <canvas
          ref={overlayRef}
          width={1400}
          height={800}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ ...canvasStyle, zIndex: 2, cursor: cursorStyle }}
        />

        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            onMove={(id, x, y) => moveNote(id, x, y, socketRef)}
            onTextChange={(id, text) => updateNoteText(id, text, socketRef)}
            onDelete={deleteNote}
            canvasRef={canvasRef}
          />
        ))}

        {Object.entries(cursors).map(([id, cursor]) => {
          const s = toScreenCoords(cursor.x, cursor.y, canvasRef.current);
          return (
            <div key={id} style={{ ...cursorWrapperStyle, transform: `translate(${s.x}px,${s.y}px)` }}>
              <div style={{ ...cursorDotStyle, background: cursor.color }} />
              <div style={cursorLabelStyle}>{cursor.username || "User"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle = { display: "flex", justifyContent: "center", marginTop: 40 };
const canvasContainerStyle = {
  width: "95vw", height: "80vh", border: "2px solid black",
  background: "white", position: "relative", overflow: "hidden",
};
const canvasStyle = { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 };
const cursorWrapperStyle = { position: "absolute", pointerEvents: "none", zIndex: 5 };
const cursorDotStyle = { width: 12, height: 12, borderRadius: "50%" };
const cursorLabelStyle = {
  position: "absolute", top: 14, left: 0, fontSize: 12,
  background: "black", color: "white", padding: "2px 6px",
  borderRadius: 6, whiteSpace: "nowrap",
};
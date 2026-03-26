import { useRef, useState, useEffect } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useCursor from "../hooks/useCursor";
import useNotes from "../hooks/useNotes";
import Toolbar from "../components/Toolbar";
import StickyNote from "../components/StickyNote";
import { getCanvasCoords, toScreenCoords } from "../utils/canvasUtils";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);
  const { cursors, updateCursor } = useCursor();
  const socketRef = useSocket(boardId, handleSocketMessage);

  const {
    handleMouseMove: drawMouseMove,
    drawRemote,
    saveSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool,
  } = useDrawing(canvasRef, socketRef);

  const { notes, createNote, moveNote, updateNoteText, deleteNote, applyRemoteNote } =
    useNotes(socketRef);

  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem("drawing_username");
    if (saved) return saved;
    return "User-" + Math.floor(Math.random() * 10000);
  });

  const updateUsername = (newName) => {
    setUsername(newName);
    localStorage.setItem("drawing_username", newName);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (ctrlOrCmd && e.key === "y") ||
        (ctrlOrCmd && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  function handleSocketMessage(data) {
    switch (data.type) {
      case "cursor_move":
        updateCursor(data.userId, data.x, data.y, data.username);
        break;
      case "draw":
        drawRemote(canvasRef, data);
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

  const clearBoard = () => {
    saveSnapshot();
    clearCanvas();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "clear_board" }));
    }
  };

  const handleSaveImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `drawing-${boardId}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const handlePointerDown = (e) => {
    if (tool === "note") {
      const { x, y } = getCanvasCoords(e, canvasRef.current);
      createNote(x, y);
    } else {
      saveSnapshot();
    }
  };

  const handlePointerMove = (e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "cursor_move", x, y, username })
      );
    }
    if (tool !== "note") drawMouseMove(e);
  };

  const cursorStyle = tool === "note" ? "cell" : "crosshair";

  return (
    <div style={containerStyle}>
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        clearBoard={clearBoard}
        saveImage={handleSaveImage}
        username={username}
        setUsername={updateUsername}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          style={{ ...canvasStyle, cursor: cursorStyle }}
        />

        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            onMove={moveNote}
            onTextChange={updateNoteText}
            onDelete={deleteNote}
            canvasRef={canvasRef}
          />
        ))}

        {Object.entries(cursors).map(([id, cursor]) => {
          const screen = toScreenCoords(cursor.x, cursor.y, canvasRef.current);
          return (
            <div
              key={id}
              style={{
                ...cursorWrapperStyle,
                transform: `translate(${screen.x}px, ${screen.y}px)`,
              }}
            >
              <div style={{ ...cursorDotStyle, background: cursor.color }} />
              <div style={cursorLabelStyle}>{cursor.username || "User"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const containerStyle = {
  display: "flex",
  justifyContent: "center",
  marginTop: 40,
};

const canvasContainerStyle = {
  width: "95vw",
  height: "80vh",
  border: "2px solid black",
  background: "white",
  position: "relative",
  overflow: "hidden",
};

const canvasStyle = {
  width: "100%",
  height: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 0,
};

const cursorWrapperStyle = {
  position: "absolute",
  pointerEvents: "none",
  zIndex: 5,
};

const cursorDotStyle = {
  width: 12,
  height: 12,
  borderRadius: "50%",
};

const cursorLabelStyle = {
  position: "absolute",
  top: 14,
  left: 0,
  fontSize: 12,
  background: "black",
  color: "white",
  padding: "2px 6px",
  borderRadius: 6,
  whiteSpace: "nowrap",
};
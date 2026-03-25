import { useRef, useState } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useCursor from "../hooks/useCursor";
import Toolbar from "../components/Toolbar";
import { getCanvasCoords, toScreenCoords } from "../utils/canvasUtils";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);
  const { cursors, updateCursor } = useCursor();
  const socketRef = useSocket(boardId, handleSocketMessage);

  const {
    handleMouseMove: drawMouseMove,
    drawRemote,
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool,
  } = useDrawing(canvasRef, socketRef);

  // Username handling
  const [username, setUsername] = useState(() => {
    const saved = localStorage.getItem("drawing_username");
    if (saved) return saved;
    return "User-" + Math.floor(Math.random() * 10000);
  }); 

  const updateUsername = (newName) => {
    setUsername(newName);
    localStorage.setItem("drawing_username", newName);
    };

  // Helper to clear canvas
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
      default:
        break;
    }
  }

  const clearBoard = () => {
    clearCanvas();
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "clear_board" }));
    }
  };

  const handleSaveImage = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `drawing-${boardId}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const handlePointerMove = (e) => {
    if (!canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);

    // Send cursor position
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "cursor_move", x, y, username,}));
    }

    drawMouseMove(e);
  };

  const handlePointerUp = () => {
  };

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
      />
      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={canvasStyle}
        />
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

// Styles
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
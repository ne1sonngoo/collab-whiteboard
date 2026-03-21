import { useRef } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

export default function Canvas({ boardId }) {
  // =========================
  // REFS & LOCAL STATE
  // =========================
  const canvasRef = useRef(null);
  const livePositions = useRef(new Map());

  const { cursors, updateCursor } = useCursor();

  // =========================
  // SOCKET HANDLING
  // =========================
  function handleSocketMessage(data) {
    switch (data.type) {
      case "cursor_move":
        updateCursor(data.userId, data.x, data.y);
        break;

      case "draw":
        drawRemote(canvasRef, data);
        break;

      case "note_create":
        setNotes((prev) => [...prev, data.note]);
        break;

      case "note_move":
        setNotes((prev) =>
          prev.map((note) =>
            note.id === data.id
              ? { ...note, x: data.x, y: data.y }
              : note
          )
        );
        break;

      case "note_resize":
        setNotes((prev) =>
          prev.map((note) =>
            note.id === data.id
              ? { ...note, width: data.width, height: data.height }
              : note
          )
        );
        break;

      case "clear_board":
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setNotes([]);
        break;

      default:
        break;
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

  // =========================
  // NOTES SYSTEM
  // =========================
  const {
    notes,
    setNotes,
    createNote,
    startDragging,
    stopDragging,
    draggingNote,
    dragOffset,
    startResizing,
    resizeNote,
    stopResizing,
    resizingNote,
    bringToFront,
  } = useNotes(socketRef, livePositions);

  // =========================
  // DRAWING SYSTEM
  // =========================
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

  // =========================
  // UI ACTIONS
  // =========================
  const clearBoard = () => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    setNotes([]);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "clear_board" }));
    }
  };

  // =========================
  // POINTER HANDLERS
  // =========================
  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerMove = (e) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoords(e);

    // resizing
    if (resizingNote?.current) {
      resizeNote(x, y);
      return;
    }

    // dragging (FAST PATH - no React)
    if (draggingNote?.current) {
      const offset = dragOffset.current;

      livePositions.current.set(draggingNote.current, {
        x: x - offset.x,
        y: y - offset.y,
      });

      return;
    }

    // drawing
    drawMouseMove(e);
  };

  const handlePointerUp = (e) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoords(e);

    if (resizingNote?.current) {
      stopResizing();
      return;
    }

    if (draggingNote?.current) {
      const offset = dragOffset.current;
      stopDragging(x - offset.x, y - offset.y);
    }
  };

  // =========================
  // STYLES
  // =========================
  const toolbarStyle = {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 12,
    padding: "10px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
    border: "1px solid rgba(255,255,255,0.3)",
    zIndex: 1000,
  };

  // =========================
  // RENDER
  // =========================
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: 40,
      }}
    >
      {/* FLOATING TOOLBAR */}
      <div style={toolbarStyle}>
        <button onClick={() => setTool("pen")}>✏️</button>
        <button onClick={() => setTool("eraser")}>🧽</button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />

        <input
          type="range"
          min="1"
          max="20"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
        />

        <button onClick={createNote}>📝</button>
        <button onClick={clearBoard}>🗑️</button>
      </div>

      {/* CANVAS CONTAINER */}
      <div
        style={{
          width: "95vw",
          height: "80vh",
          border: "2px solid black",
          background: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* DRAWING CANVAS */}
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        />

        {/* CURSORS */}
        {Object.entries(cursors).map(([id, cursor]) => (
          <div
            key={id}
            style={{
              position: "absolute",
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              width: 10,
              height: 10,
              background: "red",
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        ))}

        {/* NOTES */}
        {notes.map((note) => {
          const live = livePositions.current.get(note.id);
          const x = live?.x ?? note.x;
          const y = live?.y ?? note.y;

          return (
            <div
              key={note.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                bringToFront(note.id);
                e.currentTarget.setPointerCapture(e.pointerId);

                const { x, y } = getCanvasCoords(e);
                startDragging(note, x, y);
              }}
              style={{
                position: "absolute",
                transform: `translate(${x}px, ${y}px)`,
                width: note.width,
                height: note.height,
                background: "#fff8a6",
                borderRadius: 12,
                padding: 12,
                boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                border: "1px solid rgba(0,0,0,0.1)",
                cursor:
                  draggingNote.current === note.id ? "grabbing" : "grab",
                zIndex: note.zIndex || 1,
                willChange: "transform",
              }}
            >
              {/* NOTE TEXT */}
              <div
                contentEditable
                suppressContentEditableWarning
                style={{
                  outline: "none",
                  width: "100%",
                  height: "100%",
                }}
                onBlur={(e) => {
                  const newText = e.target.innerText;

                  setNotes((prev) =>
                    prev.map((n) =>
                      n.id === note.id ? { ...n, text: newText } : n
                    )
                  );
                }}
              >
                {note.text}
              </div>

              {/* RESIZE HANDLE */}
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);

                  const { x, y } = getCanvasCoords(e);
                  startResizing(note, x, y);
                }}
                style={{
                  position: "absolute",
                  width: 24,
                  height: 24,
                  right: -8,
                  bottom: -8,
                  cursor: "nwse-resize",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    background: "black",
                    position: "absolute",
                    right: 4,
                    bottom: 4,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
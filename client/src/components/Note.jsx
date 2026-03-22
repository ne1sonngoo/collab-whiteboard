import { useRef } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

import Toolbar from "../components/Toolbar";
import NotesLayer from "../components/NotesLayer";

export default function Canvas({ boardId }) {
  // =========================
  // REFS
  // =========================
  const canvasRef = useRef(null);
  const livePositions = useRef(new Map());

  // =========================
  // CURSOR SYSTEM
  // =========================
  const { cursors, updateCursor } = useCursor();
  
  // =========================
  // SOCKET HANDLER
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
  // UTIL: CANVAS COORDS
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

  // =========================
  // POINTER EVENTS
  // =========================
  const handlePointerMove = (e) => {
    if (!canvasRef.current) return;

    const { x, y } = getCanvasCoords(e);

    // =========================
    // SEND CURSOR POSITION
    // =========================
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "cursor_move",
          x,
          y,
        })
      );
    }

    // resize
    if (resizingNote?.current) {
      resizeNote(x, y);
      return;
    }

    // drag (FAST PATH)
    if (draggingNote?.current) {
      const offset = dragOffset.current;

      livePositions.current.set(draggingNote.current, {
        x: x - offset.x,
        y: y - offset.y,
      });

      return;
    }

    // draw
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

  // scale cursor positions to screen coords for rendering
  const toScreenCoords = (x, y) => {
    if (!canvasRef.current) return { x, y };

    const rect = canvasRef.current.getBoundingClientRect();

    const scaleX = rect.width / canvasRef.current.width;
    const scaleY = rect.height / canvasRef.current.height;

    return {
      x: x * scaleX,
      y: y * scaleY,
    };
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
      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        createNote={createNote}
        clearBoard={clearBoard}
      />

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
        {Object.entries(cursors).map(([id, cursor]) => {
          const screen = toScreenCoords(cursor.x, cursor.y);

          return (
            <div
              key={id}
              style={{
                position: "absolute",
                transform: `translate(${screen.x}px, ${screen.y}px)`,
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              {/* cursor dot */}
              <div
                style={{
                  width: 12,
                  height: 12,
                  background: cursor.color || "#3b82f6",
                  borderRadius: "50%",
                }}
              />

              {/* label */}
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  left: 0,
                  fontSize: 12,
                  background: "black",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                }}
              >
                User
              </div>
            </div>
          );
        })}

        {/* NOTES LAYER */}
        <NotesLayer
          notes={notes}
          livePositions={livePositions}
          draggingNote={draggingNote}
          resizingNote={resizingNote}
          bringToFront={bringToFront}
          startDragging={startDragging}
          startResizing={startResizing}
          setNotes={setNotes}
          getCanvasCoords={getCanvasCoords}
        />
      </div>
    </div>
  );
}
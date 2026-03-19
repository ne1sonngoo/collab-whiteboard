import { useRef } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);

  const { cursors, updateCursor } = useCursor();

  // define handler first so it's stable and can be used in hooks that need it (like useNotes)
  function handleSocketMessage(data) {
    if (data.type === "cursor_move") {
      updateCursor(data.userId, data.x, data.y);
    }

    if (data.type === "draw") {
      drawRemote(canvasRef, data);
    }

    if (data.type === "note_create") {
      setNotes((prev) => [...prev, data.note]);
    }

    if (data.type === "note_move") {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.id
            ? { ...note, x: data.x, y: data.y }
            : note
        )
      );
    }

    if (data.type === "clear_board") {
      const ctx = canvasRef.current.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      setNotes([]);
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

  // ✅ FIX: destructure EVERYTHING you actually use
  const {
    notes,
    setNotes,
    createNote,
    startDragging,
    stopDragging,
    draggingNote,
    dragOffset
  } = useNotes(socketRef);

  const {
    handleMouseMove: drawMouseMove,
    drawRemote,
    color,
    setColor,
    size,
    setSize,
    tool,
    setTool
  } = useDrawing(canvasRef, socketRef);

  const clearBoard = () => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    setNotes([]);

    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "clear_board"
        })
      );
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (draggingNote.current) {
      const id = draggingNote.current;
      const offset = dragOffset.current;

      const newX = x - offset.x;
      const newY = y - offset.y;
      return;
    }

    drawMouseMove(e);
  };

  const handleMouseUp = (e) => {
    if (!draggingNote.current) return;

    const rect = canvasRef.current.getBoundingClientRect();

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const offset = dragOffset.current;

    stopDragging(x - offset.x, y - offset.y);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 40
      }}
    >
      <div style={{ marginBottom: 10 }}>
        {/* DEBUG BUTTON */}
        <button
          onClick={() => {
            console.log("Add Note clicked");
            createNote();
          }}
        >
          Add Note
        </button>

        <button onClick={clearBoard} style={{ marginLeft: 10 }}>
          Clear Board
        </button>

        <button
          onClick={() => setTool("pen")}
          style={{
            marginLeft: 10,
            background: tool === "pen" ? "#ddd" : "white"
          }}
        >
          Pen
        </button>

        <button
          onClick={() => setTool("eraser")}
          style={{
            marginLeft: 5,
            background: tool === "eraser" ? "#ddd" : "white"
          }}
        >
          Eraser
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ marginLeft: 10 }}
        />

        <input
          type="range"
          min="1"
          max="10"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ marginLeft: 10 }}
        />
      </div>

      <div
        style={{
          width: "95vw",
          height: "80vh",
          border: "2px solid black",
          background: "white",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* CANVAS (background layer) */}
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0
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
              zIndex: 5
            }}
          />
        ))}

        {/* NOTES (on top) */}
        {notes.map((note) => (
          <div
            key={note.id}
            id={`note-${note.id}`}
            onMouseDown={(e) => {
              e.stopPropagation();

              const rect =
                canvasRef.current.getBoundingClientRect();

              const scaleX = canvasRef.current.width / rect.width;
              const scaleY = canvasRef.current.height / rect.height;

              const x = (e.clientX - rect.left) * scaleX;
              const y = (e.clientY - rect.top) * scaleY;

              startDragging(note, x, y);
            }}
            style={{
              position: "absolute",
              left: note.x,   // ✅ IMPORTANT (not transform)
              top: note.y,    // ✅ IMPORTANT
              background: "yellow",
              padding: "10px",
              border: "1px solid black",
              cursor:
                draggingNote.current === note.id
                  ? "grabbing"
                  : "grab",
              minWidth: 120,
              zIndex: 10
            }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              style={{
                outline: "none",
                userSelect: "text"
              }}
              onBlur={(e) => {
                const newText = e.target.innerText;

                setNotes((prev) =>
                  prev.map((n) =>
                    n.id === note.id
                      ? { ...n, text: newText }
                      : n
                  )
                );
              }}
            >
              {note.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
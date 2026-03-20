import { useRef, useEffect } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);
  const livePositions = useRef(new Map());
  const { cursors, updateCursor } = useCursor();

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

    if (data.type === "note_resize") {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.id
            ? { ...note, width: data.width, height: data.height }
            : note
        )
      );
    }

    if (data.type === "clear_board") {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setNotes([]);
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);

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

  useEffect(() => {
    let frame;

    const update = () => {
      frame = requestAnimationFrame(update);

      setNotes((prev) =>
        prev.map((n) => {
          const live = livePositions.current.get(n.id);
          return live ? { ...n, ...live } : n;
        })
      );
    };

    update();

    return () => cancelAnimationFrame(frame);
  }, []);

  const clearBoard = () => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    setNotes([]);

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "clear_board" }));
    }
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // smooth resize
    if (resizingNote?.current) {
      resizeNote(x, y);
      return;
    }

    // smooth drag
    if (draggingNote?.current) {
      const offset = dragOffset.current;

      const newX = x - offset.x;
      const newY = y - offset.y;

      livePositions.current.set(draggingNote.current, {
        x: newX,
        y: newY,
      });

      return;
    }

    drawMouseMove(e);
  };

  const handleMouseUp = (e) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (resizingNote?.current) {
      stopResizing();
      return;
    }

    if (draggingNote?.current) {
      const offset = dragOffset.current;
      stopDragging(x - offset.x, y - offset.y);
    }
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
        <button onClick={createNote}>Add Note</button>

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
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
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

        {/* NOTES */}
        {notes.map((note) => (
          <div
            key={note.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              bringToFront(note.id);
              e.currentTarget.setPointerCapture(e.pointerId);

              const rect =
                canvasRef.current.getBoundingClientRect();

              const scaleX =
                canvasRef.current.width / rect.width;
              const scaleY =
                canvasRef.current.height / rect.height;

              const x =
                (e.clientX - rect.left) * scaleX;
              const y =
                (e.clientY - rect.top) * scaleY;

              startDragging(note, x, y);
            }}
            style={{
              position: "absolute",
              transform: `translate(${note.x}px, ${note.y}px)`,
              willChange: "transform",
              width: note.width || 120,
              height: note.height || 60,
              background: "yellow",
              padding: "10px",
              border:
                resizingNote.current === note.id
                  ? "2px solid blue"
                  : "1px solid black",
              cursor:
                draggingNote.current === note.id
                  ? "grabbing"
                  : "grab",
              zIndex: note.zIndex || 1,
              boxSizing: "border-box"
            }}
          >
            {/* TEXT */}
            <div
              contentEditable
              suppressContentEditableWarning
              style={{
                outline: "none",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                pointerEvents:
                  resizingNote.current === note.id
                    ? "none"
                    : "auto"
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

            {/* RESIZE HANDLE (big hitbox) */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);

                const rect =
                  canvasRef.current.getBoundingClientRect();

                const scaleX =
                  canvasRef.current.width / rect.width;
                const scaleY =
                  canvasRef.current.height / rect.height;

                const x =
                  (e.clientX - rect.left) * scaleX;
                const y =
                  (e.clientY - rect.top) * scaleY;

                startResizing(note, x, y);
              }}
              style={{
                position: "absolute",
                width: 24,
                height: 24,
                right: -8,
                bottom: -8,
                cursor: "nwse-resize",
                zIndex: 20
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
                  borderRadius: 2
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
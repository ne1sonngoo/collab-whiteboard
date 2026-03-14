import { useEffect, useRef, useState } from "react";

export default function Canvas({ boardId }) {
  const draggingNote = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const prevPoint = useRef(null);

  const [notes, setNotes] = useState([]);

  useEffect(() => {

    socketRef.current = new WebSocket("ws://localhost:3001");

    socketRef.current.onopen = () => {
      socketRef.current.send(
        JSON.stringify({
          type: "join",
          room: boardId
        })
      );
    };

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const ctx = canvasRef.current.getContext("2d");

      if (data.type === "draw") {
        ctx.beginPath();
        ctx.moveTo(data.x1, data.y1);
        ctx.lineTo(data.x2, data.y2);
        ctx.stroke();
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
    };

    const stopDragging = () => {
      draggingNote.current = null;
      prevPoint.current = null;
    };

    window.addEventListener("mouseup", stopDragging);

    return () => {
      window.removeEventListener("mouseup", stopDragging);
    };

  }, [boardId]);

  const handleMouseMove = (e) => {

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // move note if dragging
    if (draggingNote.current) {

      const id = draggingNote.current;

      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, x, y } : note
        )
      );

      socketRef.current.send(
        JSON.stringify({
          type: "note_move",
          id,
          x,
          y
        })
      );

      return;
    }

    // drawing
    if (e.buttons !== 1) return;

    if (!prevPoint.current) {
      prevPoint.current = { x, y };
      return;
    }

    const { x: x1, y: y1 } = prevPoint.current;

    const ctx = canvasRef.current.getContext("2d");

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x, y);
    ctx.stroke();

    socketRef.current.send(
      JSON.stringify({
        type: "draw",
        x1,
        y1,
        x2: x,
        y2: y
      })
    );

    prevPoint.current = { x, y };
  };

  const handleMouseUp = () => {
    prevPoint.current = null;
    draggingNote.current = null;
  };

  const createNote = () => {

    const note = {
      id: crypto.randomUUID(),
      text: "New note",
      x: 200,
      y: 200
    };

    setNotes((prev) => [...prev, note]);

    socketRef.current.send(
      JSON.stringify({
        type: "note_create",
        note
      })
    );

  };

  return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "80vh",
      position: "relative"
    }}
  >
    <h2>Collaborative Whiteboard</h2>

    <button
      onClick={createNote}
      style={{ marginBottom: "10px" }}
    >
      Add Note
    </button>

    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={1800}
        height={1000}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          border: "2px solid black",
          background: "white"
        }}
      />

      {notes.map((note) => (
        <div
          key={note.id}
          onMouseDown={() => {
            draggingNote.current = note.id;
          }}
          style={{
            position: "absolute",
            left: note.x,
            top: note.y,
            background: "yellow",
            padding: "10px",
            border: "1px solid black",
            cursor: "grab"
          }}
        >
          {note.text}
        </div>
      ))}
    </div>
  </div>
);
}
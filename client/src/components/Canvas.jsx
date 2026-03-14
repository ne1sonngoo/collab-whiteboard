import { useRef } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);

  const { cursors, updateCursor } = useCursor();
  const socketRef = useSocket(boardId, handleSocketMessage);

  const { handleMouseMove, handleMouseUp, drawRemote } =
    useDrawing(canvasRef, socketRef);

  const { notes, setNotes, draggingNote, createNote, moveNote } =
    useNotes(socketRef);

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
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "40px"
      }}
    >
      <h2>Collaborative Whiteboard</h2>

      <button onClick={createNote}>Add Note</button>

      <div
        style={{
          width: "95vw",
          height: "80vh",
          border: "2px solid black",
          background: "white",
          position: "relative"
        }}
      >
        <canvas
          ref={canvasRef}
          width={1400}
          height={800}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ width: "100%", height: "100%" }}
        />

        {Object.entries(cursors).map(([id, cursor]) => (
          <div
            key={id}
            style={{
              position: "absolute",
              left: cursor.x,
              top: cursor.y,
              width: "10px",
              height: "10px",
              background: "red",
              borderRadius: "50%",
              pointerEvents: "none"
            }}
          />
        ))}

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
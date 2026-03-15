import { useRef } from "react";
import useSocket from "../hooks/useSocket";
import useDrawing from "../hooks/useDrawing";
import useNotes from "../hooks/useNotes";
import useCursor from "../hooks/useCursor";

export default function Canvas({ boardId }) {
  const canvasRef = useRef(null);
  const { cursors, updateCursor } = useCursor();

  function handleSocketMessage(data) {
    if (data.type === "cursor_move") updateCursor(data.userId, data.x, data.y);
    if (data.type === "draw") drawRemote(canvasRef, data);
    if (data.type === "note_create") setNotes((prev) => [...prev, data.note]);
    if (data.type === "note_move") {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === data.id ? { ...n, x: data.x, y: data.y } : n
        )
      );
    }
  }

  const socketRef = useSocket(boardId, handleSocketMessage);
  const { notes, setNotes, createNote, startDragging, stopDragging, draggingNote, dragOffset } = useNotes(socketRef);
  const { handleMouseMove: drawMouseMove, drawRemote } = useDrawing(canvasRef, socketRef);

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
      const el = document.getElementById(`note-${id}`);
      if (el) el.style.transform = `translate(${newX}px, ${newY}px)`;
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
      <h2>Collaborative Whiteboard</h2>
      <button onClick={createNote}>Add Note</button>
      <div style={{ width: "95vw", height: "80vh", border: "2px solid black", background: "white", position: "relative", overflow: "hidden" }}>
        <canvas ref={canvasRef} width={1400} height={800} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} style={{ width: "100%", height: "100%" }} />
        {Object.entries(cursors).map(([id, cursor]) => (
          <div key={id} style={{ position: "absolute", transform: `translate(${cursor.x}px,${cursor.y}px)`, width: 10, height: 10, background: "red", borderRadius: "50%", pointerEvents: "none" }} />
        ))}
        {notes.map((note) => (
          <div key={note.id} id={`note-${note.id}`} onMouseDown={(e) => {
            e.stopPropagation();
            const rect = canvasRef.current.getBoundingClientRect();
            const scaleX = canvasRef.current.width / rect.width;
            const scaleY = canvasRef.current.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            startDragging(note, x, y);
          }} style={{ position: "absolute", transform: `translate(${note.x}px, ${note.y}px)`, background: "yellow", padding: "10px", border: "1px solid black", cursor: draggingNote.current === note.id ? "grabbing" : "grab", minWidth: 120 }}>
            <div contentEditable suppressContentEditableWarning style={{ outline: "none", userSelect: "text" }} onBlur={(e) => {
              const newText = e.target.innerText;
              setNotes((prev) => prev.map(n => n.id === note.id ? { ...n, text: newText } : n));
            }}>
              {note.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
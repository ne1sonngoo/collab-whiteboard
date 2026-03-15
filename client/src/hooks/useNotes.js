import { useRef, useState } from "react";

export default function useNotes(socketRef) {
  const [notes, setNotes] = useState([]);
  const draggingNote = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDragging = (note, cursorX, cursorY) => {
    draggingNote.current = note.id;
    dragOffset.current = { x: cursorX - note.x, y: cursorY - note.y };
  };

  const stopDragging = (finalX, finalY) => {
    if (!draggingNote.current) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === draggingNote.current ? { ...n, x: finalX, y: finalY } : n,
      ),
    );
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_move",
          id: draggingNote.current,
          x: finalX,
          y: finalY,
        }),
      );
    }
    draggingNote.current = null;
  };

  const createNote = () => {
    const note = {
      id: crypto.randomUUID(),
      text: "New note",
      x: 200,
      y: 200,
    };
    setNotes((prev) => [...prev, note]);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "note_create", note }));
    }
  };

  return {
    notes,
    setNotes,
    createNote,
    startDragging,
    stopDragging,
    draggingNote,
    dragOffset,
  };
}

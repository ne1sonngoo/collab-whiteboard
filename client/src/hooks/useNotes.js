import { useRef, useState } from "react";

export default function useNotes(socketRef) {
  const [notes, setNotes] = useState([]);

  const draggingNote = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const startDragging = (note, cursorX, cursorY) => {
    draggingNote.current = note.id;

    dragOffset.current = {
      x: cursorX - note.x,
      y: cursorY - note.y,
    };
  };

  const stopDragging = (finalX, finalY) => {
    if (!draggingNote.current) return;

    const id = draggingNote.current;

    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x: finalX, y: finalY } : n)),
    );

    if (socketRef?.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_move",
          id,
          x: finalX,
          y: finalY,
        }),
      );
    }

    draggingNote.current = null;
  };

  const createNote = () => {
    const newNote = {
      id: Date.now(),
      text: "New Note",
      x: 100,
      y: 100,
    };

    console.log("Creating note:", newNote);

    setNotes((prev) => [...prev, newNote]);

    if (socketRef?.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_create",
          note: newNote,
        }),
      );
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

import { useRef, useState } from "react";

export default function useNotes(socketRef) {
  const [notes, setNotes] = useState([]);
  const draggingNote = useRef(null);

  const createNote = () => {
    const note = {
      id: crypto.randomUUID(),
      text: "New note",
      x: 200,
      y: 200,
    };

    setNotes((prev) => [...prev, note]);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_create",
          note,
        }),
      );
    }
  };

  const moveNote = (id, x, y) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, x, y } : note)),
    );

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_move",
          id,
          x,
          y,
        }),
      );
    }
  };

  return {
    notes,
    setNotes,
    draggingNote,
    createNote,
    moveNote,
  };
}

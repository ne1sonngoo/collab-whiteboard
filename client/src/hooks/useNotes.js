import { useState, useCallback } from "react";

const NOTE_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];

let localIdCounter = 0;

export default function useNotes(socketRef) {
  const [notes, setNotes] = useState([]);

  const createNote = useCallback(
    (x, y) => {
      const id = `${Date.now()}-${++localIdCounter}`;
      const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
      const note = { id, x, y, text: "", color };
      setNotes((prev) => [...prev, note]);
      socketRef.current?.readyState === WebSocket.OPEN &&
        socketRef.current.send(JSON.stringify({ type: "note_create", note }));
      return id;
    },
    [socketRef],
  );

  const moveNote = useCallback(
    (id, x, y) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
      socketRef.current?.readyState === WebSocket.OPEN &&
        socketRef.current.send(JSON.stringify({ type: "note_move", id, x, y }));
    },
    [socketRef],
  );

  const updateNoteText = useCallback(
    (id, text) => {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
      socketRef.current?.readyState === WebSocket.OPEN &&
        socketRef.current.send(
          JSON.stringify({ type: "note_update", id, text }),
        );
    },
    [socketRef],
  );

  const deleteNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const applyRemoteNote = useCallback((data) => {
    if (data.type === "note_create") {
      setNotes((prev) =>
        prev.some((n) => n.id === data.note.id) ? prev : [...prev, data.note],
      );
    }
    if (data.type === "note_move") {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === data.id ? { ...n, x: data.x, y: data.y } : n,
        ),
      );
    }
    if (data.type === "note_update") {
      setNotes((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, text: data.text } : n)),
      );
    }
  }, []);

  return {
    notes,
    createNote,
    moveNote,
    updateNoteText,
    deleteNote,
    applyRemoteNote,
  };
}

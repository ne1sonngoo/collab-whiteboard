import { useState, useCallback } from "react";

const NOTE_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];
let localIdCounter = 0;

export default function useNotes() {
  const [notes, setNotes] = useState([]);

  // socketRef passed at call time — never stale
  const createNote = (x, y, socketRef) => {
    const id = `${Date.now()}-${++localIdCounter}`;
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const note = { id, x, y, text: "", color };
    setNotes((prev) => [...prev, note]);
    if (socketRef?.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: "note_create", note }));
    return id;
  };

  const moveNote = (id, x, y, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    if (socketRef?.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: "note_move", id, x, y }));
  };

  const updateNoteText = (id, text, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    if (socketRef?.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: "note_update", id, text }));
  };

  const deleteNote = useCallback((id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const applyRemoteNote = useCallback((data) => {
    if (data.type === "note_create")
      setNotes((prev) =>
        prev.some((n) => n.id === data.note.id) ? prev : [...prev, data.note],
      );
    if (data.type === "note_move")
      setNotes((prev) =>
        prev.map((n) =>
          n.id === data.id ? { ...n, x: data.x, y: data.y } : n,
        ),
      );
    if (data.type === "note_update")
      setNotes((prev) =>
        prev.map((n) => (n.id === data.id ? { ...n, text: data.text } : n)),
      );
  }, []);

  const initNotes = useCallback((noteArray) => {
    setNotes(noteArray);
  }, []);

  return {
    notes,
    createNote,
    moveNote,
    updateNoteText,
    deleteNote,
    applyRemoteNote,
    initNotes,
  };
}

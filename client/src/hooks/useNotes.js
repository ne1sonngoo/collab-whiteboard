/**
 * useNotes.js
 * Manages sticky note state. All mutations broadcast over the socket.
 * socketRef is passed at call-time (never stored) to avoid stale refs.
 */
import { useState, useCallback } from "react";

const NOTE_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];
let localIdCounter = 0;

const send = (socketRef, data) => {
  if (socketRef?.current?.readyState === WebSocket.OPEN)
    socketRef.current.send(JSON.stringify(data));
};

export default function useNotes() {
  const [notes, setNotes] = useState([]);

  const createNote = (x, y, socketRef) => {
    const id = `${Date.now()}-${++localIdCounter}`;
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const note = { id, x, y, text: "", color };
    setNotes((prev) => [...prev, note]);
    send(socketRef, { type: "note_create", note });
    return id;
  };

  const moveNote = (id, x, y, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    send(socketRef, { type: "note_move", id, x, y });
  };

  const updateNoteText = (id, text, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    send(socketRef, { type: "note_update", id, text });
  };

  // Delete broadcasts so all clients remove the note
  const deleteNote = (id, socketRef) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    send(socketRef, { type: "note_delete", id });
  };

  const applyRemoteNote = useCallback((data) => {
    switch (data.type) {
      case "note_create":
        setNotes((prev) =>
          prev.some((n) => n.id === data.note.id) ? prev : [...prev, data.note],
        );
        break;
      case "note_move":
        setNotes((prev) =>
          prev.map((n) =>
            n.id === data.id ? { ...n, x: data.x, y: data.y } : n,
          ),
        );
        break;
      case "note_update":
        setNotes((prev) =>
          prev.map((n) => (n.id === data.id ? { ...n, text: data.text } : n)),
        );
        break;
      case "note_delete":
        setNotes((prev) => prev.filter((n) => n.id !== data.id));
        break;
      default:
        break;
    }
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

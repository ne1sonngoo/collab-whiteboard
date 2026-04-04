/**
 * useNotes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages sticky note state for the local client.
 *
 * Design principle — socketRef is passed at *call time*, never stored:
 *   Bad:  const moveNote = useCallback((id,x,y) => { socketRef.current.send(...) }, [socketRef])
 *         ^ socketRef captured at hook-init time; can become stale after Strict Mode remount
 *   Good: const moveNote = (id, x, y, socketRef) => { socketRef.current.send(...) }
 *         ^ always uses whichever socketRef Canvas passes in the moment of the call
 *
 * Each mutation has two steps:
 *   1. Optimistic local update — update React state immediately so the UI
 *      feels instant without waiting for a server round-trip.
 *   2. Broadcast — send the event to the server, which relays it to all
 *      other clients in the room.
 *
 * Note shape: { id, x, y, text, color, createdBy }
 *   createdBy — userId of the user who placed the note. Stored so future
 *   features (e.g. note ownership indicators, per-user undo of notes) have
 *   the data they need without a schema migration.
 */
import { useState, useCallback } from "react";

// Pastel colors cycled through when creating new notes
const NOTE_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];

// Module-level counter makes IDs unique within a session even if two notes
// are created within the same millisecond
let localIdCounter = 0;

/**
 * Small helper to send a socket message only if the connection is open.
 * Avoids repeating the readyState check in every function below.
 */
const sendMsg = (socketRef, data) => {
  if (socketRef?.current?.readyState === WebSocket.OPEN)
    socketRef.current.send(JSON.stringify(data));
};

export default function useNotes() {
  // Array of note objects: { id, x, y, text, color, createdBy }
  const [notes, setNotes] = useState([]);

  /**
   * createNote — place a new blank note at canvas coordinates (x, y).
   * Called when the user clicks the canvas while the "note" tool is active.
   * userId is included so the note carries its creator's identity.
   */
  const createNote = (x, y, socketRef, userId) => {
    const id = `${Date.now()}-${++localIdCounter}`; // unique id
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    // createdBy stores the userId of whoever placed this note
    const note = { id, x, y, text: "", color, createdBy: userId || "unknown" };
    setNotes((prev) => [...prev, note]); // optimistic local add
    sendMsg(socketRef, { type: "note_create", note }); // broadcast creation
    return id;
  };

  /**
   * moveNote — update a note's canvas-space position.
   * Called continuously while dragging, so it fires many times per second.
   * The server just overwrites x/y each time — no accumulation issues.
   */
  const moveNote = (id, x, y, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    sendMsg(socketRef, { type: "note_move", id, x, y });
  };

  /**
   * updateNoteText — update a note's text content.
   * Called on every keystroke inside the note's textarea.
   */
  const updateNoteText = (id, text, socketRef) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    sendMsg(socketRef, { type: "note_update", id, text });
  };

  /**
   * deleteNote — remove a note locally and broadcast the deletion.
   * Without broadcasting, other clients' notes would persist after deletion.
   */
  const deleteNote = (id, socketRef) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    sendMsg(socketRef, { type: "note_delete", id });
  };

  /**
   * applyRemoteNote — process an incoming socket message about a note.
   * Called by Canvas's handleSocketMessage for all note_* event types.
   * useCallback with [] ensures a stable reference — no re-registration needed.
   */
  const applyRemoteNote = useCallback((data) => {
    switch (data.type) {
      case "note_create":
        // Guard against duplicates (e.g. from Strict Mode double-fire)
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

  /**
   * initNotes — bulk-replace all notes from the server's init payload.
   * Called on join and after any undo (full board resync).
   */
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

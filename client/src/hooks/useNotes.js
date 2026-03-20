import { useRef, useState } from "react";

export default function useNotes(socketRef, livePositions) {
  const [notes, setNotes] = useState([]);

  const draggingNote = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizingNote = useRef(null);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const startDragging = (note, cursorX, cursorY) => {
    draggingNote.current = note.id;
    dragOffset.current = {
      x: cursorX - note.x,
      y: cursorY - note.y,
    };
  };

  const startResizing = (note, cursorX, cursorY) => {
    resizingNote.current = note.id;

    resizeStart.current = {
      x: cursorX,
      y: cursorY,
      w: note.width || 120,
      h: note.height || 60,
    };
  };

  const resizeNote = (cursorX, cursorY) => {
    if (!resizingNote.current) return;

    const id = resizingNote.current;
    const start = resizeStart.current;

    const dx = cursorX - start.x;
    const dy = cursorY - start.y;
    const smooth = 0.8;
    const newWidth = Math.max(80, start.w + dx * smooth);
    const newHeight = Math.max(40, start.h + dy * smooth);

    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, width: newWidth, height: newHeight } : n,
      ),
    );
  };

  const stopResizing = () => {
    if (!resizingNote.current) return;

    const id = resizingNote.current;
    const note = notes.find((n) => n.id === id);

    if (socketRef?.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "note_resize",
          id,
          width: note.width,
          height: note.height,
        }),
      );
    }

    resizingNote.current = null;
  };

  const stopDragging = (finalX, finalY) => {
    if (!draggingNote.current) return;

    const id = draggingNote.current;

    livePositions.current.delete(id);

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

  const bringToFront = (id) => {
    const topZ = Date.now();
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, zIndex: topZ } : note)),
    );
  };

  const createNote = () => {
    const newNote = {
      id: crypto.randomUUID(),
      text: "New note",
      x: 200,
      y: 200,
      width: 120,
      height: 60,
      zIndex: Date.now(),
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
    startResizing,
    resizeNote,
    stopResizing,
    resizingNote,
    bringToFront,
  };
}

import { useRef, useState } from "react";

export default function useNotes(socketRef) {
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
    startResizing,
    resizeNote,
    stopResizing,
    resizingNote,
  };
}

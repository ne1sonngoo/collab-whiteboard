import { useRef, useState } from "react";

export default function StickyNote({ note, onMove, onTextChange, onDelete, canvasRef }) {
  const dragState = useRef(null);
  const [dragging, setDragging] = useState(false);

  const toScreen = (cx, cy) => {
    if (!canvasRef.current) return { x: cx, y: cy };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: cx * (rect.width / canvasRef.current.width),
      y: cy * (rect.height / canvasRef.current.height),
    };
  };

  const screen = toScreen(note.x, note.y);

  const handlePointerDown = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNoteX: note.x,
      startNoteY: note.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragState.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const dx = (e.clientX - dragState.current.startMouseX) * scaleX;
    const dy = (e.clientY - dragState.current.startMouseY) * scaleY;
    onMove(
      note.id,
      Math.max(0, dragState.current.startNoteX + dx),
      Math.max(0, dragState.current.startNoteY + dy)
    );
  };

  const handlePointerUp = () => {
    dragState.current = null;
    setDragging(false);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: "absolute",
        left: screen.x,
        top: screen.y,
        width: 160,
        minHeight: 120,
        background: note.color,
        borderRadius: 4,
        boxShadow: dragging
          ? "0 12px 32px rgba(0,0,0,0.25)"
          : "0 4px 12px rgba(0,0,0,0.15)",
        cursor: dragging ? "grabbing" : "grab",
        zIndex: dragging ? 20 : 10,
        display: "flex",
        flexDirection: "column",
        transition: dragging ? "none" : "box-shadow 0.15s",
        userSelect: "none",
      }}
    >
      <div
        style={{
          height: 24,
          background: "rgba(0,0,0,0.08)",
          borderRadius: "4px 4px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 6px",
        }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(note.id)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "rgba(0,0,0,0.4)",
            padding: "2px 4px",
            borderRadius: 4,
          }}
          title="Delete note"
        >
          ✕
        </button>
      </div>

      <textarea
        value={note.text}
        onChange={(e) => onTextChange(note.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Type here..."
        style={{
          flex: 1,
          border: "none",
          background: "transparent",
          resize: "none",
          padding: "8px 10px",
          fontSize: 13,
          fontFamily: "'Segoe UI', sans-serif",
          outline: "none",
          cursor: "text",
          minHeight: 90,
          color: "#333",
        }}
      />
    </div>
  );
}
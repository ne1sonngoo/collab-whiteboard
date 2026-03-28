import { useRef, useState } from "react";

// posLeft / posTop are passed as CSS values (e.g. "12.5%")
// so the parent controls placement and this component just drags.
export default function StickyNote({ note, posLeft, posTop, onMove, onTextChange, onDelete, canvasRef }) {
  const dragState = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragState.current = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startNoteX: note.x, startNoteY: note.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!dragState.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // rect accounts for CSS transform so this gives correct canvas-unit deltas
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const dx = (e.clientX - dragState.current.startMouseX) * scaleX;
    const dy = (e.clientY - dragState.current.startMouseY) * scaleY;
    onMove(note.id,
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
        left: posLeft,
        top: posTop,
        width: 160,
        minHeight: 120,
        background: note.color,
        borderRadius: 4,
        boxShadow: dragging ? "0 12px 32px rgba(0,0,0,0.25)" : "0 4px 12px rgba(0,0,0,0.15)",
        cursor: dragging ? "grabbing" : "grab",
        zIndex: dragging ? 20 : 10,
        display: "flex",
        flexDirection: "column",
        transition: dragging ? "none" : "box-shadow 0.15s",
        userSelect: "none",
      }}
    >
      <div style={headerStyle}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(note.id)}
          style={deleteBtnStyle}
          title="Delete note"
        >✕</button>
      </div>
      <textarea
        value={note.text}
        onChange={(e) => onTextChange(note.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Type here..."
        style={textareaStyle}
      />
    </div>
  );
}

const headerStyle = {
  height: 24, background: "rgba(0,0,0,0.08)",
  borderRadius: "4px 4px 0 0",
  display: "flex", alignItems: "center", justifyContent: "flex-end",
  padding: "0 6px",
};
const deleteBtnStyle = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 13, color: "rgba(0,0,0,0.4)", padding: "2px 4px", borderRadius: 4,
};
const textareaStyle = {
  flex: 1, border: "none", background: "transparent",
  resize: "none", padding: "8px 10px", fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif", outline: "none",
  cursor: "text", minHeight: 90, color: "#333",
};
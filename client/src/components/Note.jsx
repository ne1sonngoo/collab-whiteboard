export default function Note({
  note,
  x,
  y,
  draggingNote,
  resizingNote,
  bringToFront,
  startDragging,
  startResizing,
  setNotes,
  getCanvasCoords,
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        bringToFront(note.id);
        e.currentTarget.setPointerCapture(e.pointerId);

        const { x, y } = getCanvasCoords(e);
        startDragging(note, x, y);
      }}
      style={{
        position: "absolute",
        transform: `translate(${x}px, ${y}px)`,
        width: note.width,
        height: note.height,
        background: "#fff8a6",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        border: "1px solid rgba(0,0,0,0.1)",
        cursor:
          draggingNote.current === note.id ? "grabbing" : "grab",
        zIndex: note.zIndex || 1,
        willChange: "transform",
      }}
    >
      {/* TEXT */}
      <div
        contentEditable
        suppressContentEditableWarning
        style={{ width: "100%", height: "100%", outline: "none" }}
        onBlur={(e) => {
          const newText = e.target.innerText;

          setNotes((prev) =>
            prev.map((n) =>
              n.id === note.id ? { ...n, text: newText } : n
            )
          );
        }}
      >
        {note.text}
      </div>

      {/* RESIZE HANDLE */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);

          const { x, y } = getCanvasCoords(e);
          startResizing(note, x, y);
        }}
        style={{
          position: "absolute",
          width: 24,
          height: 24,
          right: -8,
          bottom: -8,
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
}
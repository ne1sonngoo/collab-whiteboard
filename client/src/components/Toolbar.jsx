import { useState } from "react";

const TOOLS = [
  { id: "pen",    label: "✏️", title: "Pen" },
  { id: "eraser", label: "🧽", title: "Eraser" },
  { id: "line",   label: "╱",  title: "Line" },
  { id: "rect",   label: "▭",  title: "Rectangle" },
  { id: "circle", label: "○",  title: "Ellipse" },
  { id: "text",   label: "T",  title: "Text (click canvas to place)" },
  { id: "fill",   label: "🪣", title: "Fill (flood fill)" },
  { id: "note",   label: "📝", title: "Sticky Note" },
];

export default function Toolbar({
  tool, setTool, color, setColor, size, setSize,
  clearBoard, saveImage, username, setUsername,
  undo, redo, canUndo, canRedo,
}) {
  const [tempName, setTempName] = useState(username);

  return (
    <div style={toolbarStyle}>
      {TOOLS.map(({ id, label, title }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          title={title}
          style={{
            ...btnStyle,
            ...(tool === id ? activeBtnStyle : {}),
            ...(id === "text" ? { fontWeight: "bold", fontSize: 15 } : {}),
          }}
        >
          {label}
        </button>
      ))}

      <div style={divider} />

      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={canUndo ? btnStyle : dimBtnStyle}>↩️</button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={canRedo ? btnStyle : dimBtnStyle}>↪️</button>

      <div style={divider} />

      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" style={{ cursor: "pointer", height: 28 }} />
      <input
        type="range" min="1" max="20" value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        title={`Size: ${size}`} style={{ width: 70 }}
      />

      <div style={divider} />

      <input
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setUsername(tempName.trim())}
        onBlur={() => tempName.trim() && setUsername(tempName.trim())}
        placeholder="Your name"
        style={nameInput}
      />

      <div style={divider} />

      <button onClick={saveImage} style={btnStyle} title="Export board as PNG (includes notes)">📸</button>
      <button onClick={clearBoard} style={btnStyle} title="Clear board">🗑️</button>

      <div style={divider} />

      <span style={{ fontSize: 11, color: "#888", whiteSpace: "nowrap" }}>
        Scroll=zoom · Space+drag=pan
      </span>
    </div>
  );
}

const toolbarStyle = {
  position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)",
  display: "flex", gap: 5, padding: "8px 14px", borderRadius: 16,
  alignItems: "center", background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(12px)", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  border: "1px solid rgba(0,0,0,0.08)", zIndex: 1000,
  flexWrap: "nowrap", maxWidth: "98vw", overflowX: "auto",
};
const btnStyle = {
  cursor: "pointer", background: "none", border: "none",
  fontSize: 17, padding: "4px 7px", borderRadius: 8, lineHeight: 1,
};
const activeBtnStyle = {
  background: "rgba(0,0,0,0.1)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.18)",
};
const dimBtnStyle = { ...btnStyle, opacity: 0.3, cursor: "default" };
const divider = { width: 1, height: 22, background: "rgba(0,0,0,0.1)", margin: "0 2px", flexShrink: 0 };
const nameInput = {
  width: 84, padding: "4px 7px", borderRadius: 8,
  border: "1px solid #ddd", fontSize: 13, flexShrink: 0,
};
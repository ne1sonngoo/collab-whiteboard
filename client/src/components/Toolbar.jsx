import { useState } from "react";

const TOOLS = [
  { id: "pen",    label: "✏️",  title: "Pen" },
  { id: "eraser", label: "🧽", title: "Eraser" },
  { id: "line",   label: "╱",  title: "Line" },
  { id: "rect",   label: "▭",  title: "Rectangle" },
  { id: "circle", label: "○",  title: "Circle / Ellipse" },
  { id: "note",   label: "📝", title: "Sticky Note" },
];

export default function Toolbar({
  tool, setTool,
  color, setColor,
  size, setSize,
  clearBoard, saveImage,
  username, setUsername,
  undo, redo, canUndo, canRedo,
}) {
  const [tempName, setTempName] = useState(username);

  return (
    <div style={toolbarStyle}>
      {/* Tool buttons */}
      {TOOLS.map(({ id, label, title }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          title={title}
          style={tool === id ? activeButtonStyle : buttonStyle}
        >
          {label}
        </button>
      ))}

      <div style={dividerStyle} />

      {/* Undo / Redo */}
      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={canUndo ? buttonStyle : dimButtonStyle}>↩️</button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={canRedo ? buttonStyle : dimButtonStyle}>↪️</button>

      <div style={dividerStyle} />

      {/* Color + size */}
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" style={{ cursor: "pointer" }} />
      <input
        type="range" min="1" max="20" value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        title={`Size: ${size}`} style={{ width: 72 }}
      />

      <div style={dividerStyle} />

      {/* Username */}
      <input
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setUsername(tempName.trim())}
        onBlur={() => tempName.trim() && setUsername(tempName.trim())}
        placeholder="Your name"
        style={nameInputStyle}
      />

      <div style={dividerStyle} />

      <button onClick={saveImage} style={buttonStyle} title="Save as PNG">📸</button>
      <button onClick={clearBoard} style={buttonStyle} title="Clear board">🗑️</button>
    </div>
  );
}

const toolbarStyle = {
  position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
  display: "flex", gap: 6, padding: "10px 16px", borderRadius: 16,
  alignItems: "center", background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(10px)", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  border: "1px solid rgba(255,255,255,0.4)", zIndex: 1000,
};
const buttonStyle = {
  cursor: "pointer", background: "none", border: "none",
  fontSize: 17, padding: "4px 7px", borderRadius: 8,
};
const activeButtonStyle = {
  ...buttonStyle, background: "rgba(0,0,0,0.12)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
};
const dimButtonStyle = { ...buttonStyle, opacity: 0.3, cursor: "default" };
const dividerStyle = { width: 1, height: 24, background: "rgba(0,0,0,0.12)", margin: "0 2px" };
const nameInputStyle = { width: 90, padding: "4px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 };
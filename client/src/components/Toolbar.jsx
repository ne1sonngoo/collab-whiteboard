/**
 * Toolbar.jsx
 * Pure presentational component — no state except the name input buffer.
 * All tool/color/size state lives in the parent via props.
 */
import { useState } from "react";
import { TOOLS } from "../constants";

export default function Toolbar({
  tool, setTool, color, setColor, size, setSize,
  clearBoard, saveImage, username, setUsername,
  undo, redo, canUndo, canRedo,
}) {
  const [tempName, setTempName] = useState(username);

  const submitName = () => {
    const n = tempName.trim();
    if (n) setUsername(n);
  };

  return (
    <div style={toolbarStyle}>
      {TOOLS.map(({ id, label, title }) => (
        <button
          key={id}
          onClick={() => setTool(id)}
          title={title}
          style={tool === id ? activeBtnStyle : btnStyle}
        >
          {id === "text" ? <b>{label}</b> : label}
        </button>
      ))}

      <Divider />

      <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={canUndo ? btnStyle : dimStyle}>↩️</button>
      <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={canRedo ? btnStyle : dimStyle}>↪️</button>

      <Divider />

      <input
        type="color" value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Stroke color"
        style={{ cursor: "pointer", height: 28 }}
      />
      <input
        type="range" min="1" max="20" value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        title={`Size: ${size}`} style={{ width: 70 }}
      />

      <Divider />

      <input
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitName()}
        onBlur={submitName}
        placeholder="Your name"
        style={nameInputStyle}
      />

      <Divider />

      <button onClick={saveImage}  style={btnStyle} title="Export board as PNG (includes notes)">📸</button>
      <button onClick={clearBoard} style={btnStyle} title="Clear board">🗑️</button>

      <Divider />

      <span style={hintStyle}>Scroll=zoom · Space+drag=pan</span>
    </div>
  );
}

const Divider = () => <div style={dividerStyle} />;

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
  ...btnStyle,
  background: "rgba(0,0,0,0.1)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.18)",
};
const dimStyle       = { ...btnStyle, opacity: 0.3, cursor: "default" };
const dividerStyle   = { width: 1, height: 22, background: "rgba(0,0,0,0.1)", margin: "0 2px", flexShrink: 0 };
const nameInputStyle = { width: 84, padding: "4px 7px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, flexShrink: 0 };
const hintStyle      = { fontSize: 11, color: "#999", whiteSpace: "nowrap" };
import { useState } from "react";

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  clearBoard,
  saveImage,
  username,
  setUsername,
  undo,
  redo,
  canUndo,
  canRedo,
}) {
  const [tempName, setTempName] = useState(username);

  const handleNameSubmit = () => {
    if (tempName.trim()) setUsername(tempName.trim());
  };

  return (
    <div style={toolbarStyle}>
      <button onClick={() => setTool("pen")} style={tool === "pen" ? activeButtonStyle : buttonStyle} title="Pen">✏️</button>
      <button onClick={() => setTool("eraser")} style={tool === "eraser" ? activeButtonStyle : buttonStyle} title="Eraser">🧽</button>
      <button onClick={() => setTool("note")} style={tool === "note" ? activeButtonStyle : buttonStyle} title="Sticky Note">📝</button>

      <div style={dividerStyle} />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={canUndo ? buttonStyle : disabledButtonStyle}
      >
        ↩️
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={canRedo ? buttonStyle : disabledButtonStyle}
      >
        ↪️
      </button>

      <div style={dividerStyle} />

      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        title="Brush color"
      />
      <input
        type="range"
        min="1"
        max="20"
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        title={`Brush size: ${size}`}
      />

      <div style={dividerStyle} />

      <div style={{ display: "flex", gap: 4 }}>
        <input
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
          placeholder="Your name"
          style={{ width: 100, padding: "4px 8px", borderRadius: 8 }}
        />
        <button onClick={handleNameSubmit} style={buttonStyle} title="Set name">✔️</button>
      </div>

      <div style={dividerStyle} />

      <button onClick={saveImage} style={buttonStyle} title="Save as PNG">📸</button>
      <button onClick={clearBoard} style={buttonStyle} title="Clear board">🗑️</button>
    </div>
  );
}

const toolbarStyle = {
  position: "fixed",
  top: 20,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 8,
  padding: "10px 16px",
  borderRadius: 16,
  alignItems: "center",
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  zIndex: 1000,
};

const buttonStyle = {
  cursor: "pointer",
  background: "none",
  border: "none",
  fontSize: 18,
  padding: "4px 6px",
  borderRadius: 8,
};

const activeButtonStyle = {
  ...buttonStyle,
  background: "rgba(0,0,0,0.1)",
};

const disabledButtonStyle = {
  ...buttonStyle,
  opacity: 0.3,
  cursor: "default",
};

const dividerStyle = {
  width: 1,
  height: 24,
  background: "rgba(0,0,0,0.15)",
  margin: "0 2px",
};
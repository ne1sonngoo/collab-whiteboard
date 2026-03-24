export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  size,
  setSize,
  clearBoard,
  saveImage,
}) {
  return (
    <div style={toolbarStyle}>
      <button onClick={() => setTool("pen")}>✏️</button>
      <button onClick={() => setTool("eraser")}>🧽</button>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <input
        type="range"
        min="1"
        max="20"
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
      />
      <button onClick={saveImage}>📸</button>
      <button onClick={clearBoard}>🗑️</button>
    </div>
  );
}

const toolbarStyle = {
  position: "fixed",
  top: 20,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 12,
  padding: "10px 16px",
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.1)",
  border: "1px solid rgba(255,255,255,0.3)",
  zIndex: 1000,
};
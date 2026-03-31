/**
 * RoomTitle.jsx
 * Editable board name shown centered above the canvas.
 * Click to edit, Enter or blur to save. Updates all clients in real time.
 */
import { useState, useRef, useEffect } from "react";

export default function RoomTitle({ name, onChange }) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(name);
  const inputRef                = useRef(null);

  // Keep draft in sync if a remote rename arrives while not editing
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Auto-focus + select all when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim() || "Untitled Board";
    setDraft(trimmed);
    setEditing(false);
    if (trimmed !== name) onChange(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(name); setEditing(false); }
  };

  const displayName = name || "Untitled Board";

  return (
    <div style={wrapperStyle}>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          maxLength={80}
          style={inputStyle}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="Click to rename board"
          style={titleStyle}
        >
          {displayName}
          <span style={editIconStyle}>✎</span>
        </button>
      )}
    </div>
  );
}

const wrapperStyle = {
  position: "fixed",
  top: 66,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 999,
  pointerEvents: "auto",
};

const titleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  color: "#444",
  padding: "4px 8px",
  borderRadius: 8,
  transition: "background 0.15s",
  whiteSpace: "nowrap",
};

const editIconStyle = {
  fontSize: 12,
  opacity: 0.45,
  fontStyle: "normal",
};

const inputStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: "#222",
  border: "1.5px solid #3b82f6",
  borderRadius: 8,
  padding: "3px 10px",
  outline: "none",
  width: 220,
  textAlign: "center",
  background: "white",
  boxShadow: "0 2px 8px rgba(59,130,246,0.15)",
};
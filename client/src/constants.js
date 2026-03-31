// ── Canvas dimensions ────────────────────────────────────────────────────────
export const CANVAS_W = 1400;
export const CANVAS_H = 800;

// ── Tool definitions ─────────────────────────────────────────────────────────
export const TOOLS = [
  { id: "pen", label: "✏️", title: "Pen" },
  { id: "eraser", label: "🧽", title: "Eraser" },
  { id: "line", label: "╱", title: "Line" },
  { id: "rect", label: "▭", title: "Rectangle" },
  { id: "circle", label: "○", title: "Ellipse" },
  { id: "text", label: "T", title: "Text — click canvas to place" },
  { id: "fill", label: "🪣", title: "Fill" },
  { id: "note", label: "📝", title: "Sticky Note" },
];

export const SHAPE_TOOLS = new Set(["rect", "circle", "line"]);

// ── Zoom limits ──────────────────────────────────────────────────────────────
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 1.1;

// ── History ──────────────────────────────────────────────────────────────────
export const MAX_HISTORY = 30;

// ── Flood fill ───────────────────────────────────────────────────────────────
export const FILL_TOLERANCE = 30;

// ── WebSocket message types ──────────────────────────────────────────────────
export const MSG = {
  JOIN: "join",
  INIT: "init",
  DRAW: "draw",
  CLEAR_BOARD: "clear_board",
  CURSOR_MOVE: "cursor_move",
  NOTE_CREATE: "note_create",
  NOTE_MOVE: "note_move",
  NOTE_UPDATE: "note_update",
  NOTE_DELETE: "note_delete",
  UNDO_LAST: "undo_last",
  ROOM_RENAME: "room_rename",
  ROOM_INFO: "room_info",
};

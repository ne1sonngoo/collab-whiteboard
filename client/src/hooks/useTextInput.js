/**
 * useTextInput.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the floating textarea that appears when the Text tool is active.
 *
 * When the user clicks the canvas:
 *   1. open(cx, cy) places a textarea at those canvas coordinates
 *   2. The user types; value is tracked locally in textInput.value
 *   3. Pressing Enter (or clicking away) calls onCommit with { cx, cy, value }
 *      → Canvas renders the text onto the canvas and broadcasts it
 *   4. Pressing Escape cancels without committing
 *
 * The textarea lives inside the zoom/pan transform wrapper so it appears
 * at the correct screen position regardless of zoom level.
 */
import { useState, useRef, useEffect } from "react";

export default function useTextInput(onCommit) {
  // null when inactive; { cx, cy, value } when a text input is open
  // cx/cy are canvas-space coordinates (not screen pixels)
  const [textInput, setTextInput] = useState(null);

  // Ref to the actual textarea DOM element for programmatic focus
  const textareaRef = useRef(null);

  // Auto-focus the textarea whenever it appears
  // The dependency is a boolean (!!textInput) rather than the object itself
  // to avoid re-running when just the value changes
  useEffect(() => {
    if (textInput) textareaRef.current?.focus();
  }, [!!textInput]);

  /**
   * open — place a new text input at canvas position (cx, cy).
   * If there's already an open input with text, commit it first.
   */
  const open = (cx, cy) => {
    if (textInput?.value?.trim()) onCommit(textInput); // commit any pending text
    setTextInput({ cx, cy, value: "" });
  };

  /** close — discard the current input without committing. */
  const close = () => setTextInput(null);

  /**
   * commit — send the current text to the canvas if it's non-empty, then close.
   * Called on Enter or blur.
   */
  const commit = () => {
    if (textInput?.value?.trim()) onCommit(textInput);
    close();
  };

  /** handleChange — update the textarea value on each keystroke. */
  const handleChange = (e) =>
    setTextInput((prev) => ({ ...prev, value: e.target.value }));

  /**
   * handleKeyDown — keyboard shortcuts inside the textarea.
   * stopPropagation prevents the whiteboard's global keydown handler
   * (undo/redo) from firing while the user is typing.
   */
  const handleKeyDown = (e) => {
    e.stopPropagation(); // don't let Ctrl+Z trigger undo while typing
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    // Shift+Enter inserts a newline (default textarea behaviour, no special handling)
  };

  return {
    textInput,
    textareaRef,
    open,
    close,
    commit,
    handleChange,
    handleKeyDown,
  };
}

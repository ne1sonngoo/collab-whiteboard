/**
 * useTextInput.js
 * Manages the floating textarea used by the Text tool.
 * Completely separate from canvas drawing — commits via a callback.
 */
import { useState, useRef, useEffect } from "react";

export default function useTextInput(onCommit) {
  const [textInput, setTextInput] = useState(null); // { cx, cy, value } | null
  const textareaRef = useRef(null);

  // Auto-focus when a new input is placed
  useEffect(() => {
    if (textInput) textareaRef.current?.focus();
  }, [!!textInput]);

  const open = (cx, cy) => {
    // Commit any in-progress text before opening a new one
    if (textInput?.value?.trim()) onCommit(textInput);
    setTextInput({ cx, cy, value: "" });
  };

  const close = () => setTextInput(null);

  const commit = () => {
    if (textInput?.value?.trim()) onCommit(textInput);
    close();
  };

  const handleChange = (e) =>
    setTextInput((prev) => ({ ...prev, value: e.target.value }));

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
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

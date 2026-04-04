/**
 * drawingUtils.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the pure utility functions in drawingUtils.js.
 *
 * Place at:  client/src/utils/drawingUtils.test.js
 *
 * Prerequisites — run once from client/:
 *   npm install -D vitest @vitest/coverage-v8 vitest-canvas-mock
 *
 * Run:
 *   npx vitest run          — single pass
 *   npx vitest              — watch mode (re-runs on save)
 *   npx vitest --coverage   — with HTML coverage report
 *
 * Why vitest-canvas-mock is required:
 *   jsdom does not implement the Canvas 2D API — getContext("2d") returns null.
 *   vitest-canvas-mock patches HTMLCanvasElement.prototype.getContext so it
 *   returns a working mock. Loaded globally via vitest.config.js → setupFiles.
 *
 * Why some tests use Object.defineProperty to intercept property setters:
 *   drawShape and commitTextToCanvas wrap all drawing in ctx.save() / ctx.restore().
 *   ctx.restore() resets strokeStyle, fillStyle, font, lineWidth etc. back to
 *   their defaults AFTER the function returns. Reading ctx.strokeStyle in a test
 *   after the function has already run will always show the reset default value.
 *   The fix is to intercept the property setter before calling the function —
 *   this captures the value at the moment it was written inside the function,
 *   before restore() cleans it up.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ctx2d,
  drawShape,
  commitTextToCanvas,
  floodFill,
  applyDrawEvent,
} from "./drawingUtils";

// ── Test helper ───────────────────────────────────────────────────────────────

/**
 * makeCanvas — creates an HTMLCanvasElement backed by vitest-canvas-mock.
 * getContext("2d") returns a spy-able mock context (not null).
 */
function makeCanvas(width = 100, height = 100) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * interceptSetter — uses Object.defineProperty to capture the value written
 * to a context property during a function call, even if ctx.restore() resets
 * it afterwards. Returns a getter for the captured value.
 *
 * @param {object} ctx      — the canvas 2D context
 * @param {string} prop     — property name e.g. "strokeStyle"
 * @param {*}      defaultVal — value to return from the getter before any set
 * @returns {{ get: () => * }} — call .get() after the function runs to read captured value
 */
function interceptSetter(ctx, prop, defaultVal) {
  let captured = undefined;
  Object.defineProperty(ctx, prop, {
    // Called when the function being tested assigns to ctx[prop]
    set(v) {
      captured = v;
    },
    // Called when the test reads ctx[prop]
    get() {
      return captured !== undefined ? captured : defaultVal;
    },
    configurable: true, // allows the mock framework to re-define it in later tests
  });
  return { get: () => captured };
}

// ── ctx2d ─────────────────────────────────────────────────────────────────────

describe("ctx2d", () => {
  it("returns a non-null 2D context with standard drawing methods", () => {
    // Baseline: confirms vitest-canvas-mock is loaded and working.
    // If this fails, check that vitest.config.js has setupFiles: ["vitest-canvas-mock"]
    const canvas = makeCanvas();
    const ctx = ctx2d(canvas);
    expect(ctx).not.toBeNull();
    expect(typeof ctx.fillRect).toBe("function");
    expect(typeof ctx.stroke).toBe("function");
    expect(typeof ctx.save).toBe("function");
    expect(typeof ctx.restore).toBe("function");
  });

  it("returns the same context instance on repeated calls for the same canvas", () => {
    // The browser spec says getContext() with the same type returns the same object.
    const canvas = makeCanvas();
    const a = ctx2d(canvas);
    const b = ctx2d(canvas);
    expect(a).toBe(b);
  });

  it("does not throw even with the willReadFrequently attribute set", () => {
    const canvas = makeCanvas();
    expect(() => ctx2d(canvas)).not.toThrow();
  });
});

// ── drawShape ─────────────────────────────────────────────────────────────────

describe("drawShape", () => {
  let canvas, ctx;

  // Fresh canvas and context before each test so spy call counts don't bleed across tests
  beforeEach(() => {
    canvas = makeCanvas();
    ctx = canvas.getContext("2d");
  });

  it("calls strokeRect with correct x/y/width/height for the rect tool", () => {
    // drawShape(ctx, tool, x0, y0, x1, y1, color, size)
    // rect → strokeRect(x0, y0, x1-x0, y1-y0)
    drawShape(ctx, "rect", 10, 20, 60, 80, "#ff0000", 2);
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 50, 60);
  });

  it("calls ellipse centered between drag points for the circle tool", () => {
    // center = ((x0+x1)/2, (y0+y1)/2), radii = (|x1-x0|/2, |y1-y0|/2)
    drawShape(ctx, "circle", 0, 0, 100, 60, "#0000ff", 3);
    expect(ctx.ellipse).toHaveBeenCalledWith(50, 30, 50, 30, 0, 0, Math.PI * 2);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("calls moveTo + lineTo + stroke for the line tool", () => {
    drawShape(ctx, "line", 5, 10, 95, 90, "#000000", 1);
    expect(ctx.moveTo).toHaveBeenCalledWith(5, 10);
    expect(ctx.lineTo).toHaveBeenCalledWith(95, 90);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("sets strokeStyle and lineWidth to the provided values during drawing", () => {
    // ctx.restore() resets these properties after the function returns,
    // so we intercept the setter to capture the value at the moment it was written.
    const strokeCapture = interceptSetter(ctx, "strokeStyle", "#000000");
    const widthCapture = interceptSetter(ctx, "lineWidth", 1);

    drawShape(ctx, "line", 0, 0, 50, 50, "#123456", 5);

    // Verify the values that were SET inside the function, not the post-restore state
    expect(strokeCapture.get()).toBe("#123456");
    expect(widthCapture.get()).toBe(5);
  });

  it("calls save() before and restore() after drawing", () => {
    // save/restore sandboxes drawing state so subsequent draws are not affected
    drawShape(ctx, "rect", 0, 0, 10, 10, "#000", 1);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("does not throw for an unknown tool type", () => {
    // Unknown tools from old server data or future versions must not crash the client
    expect(() =>
      drawShape(ctx, "laser_beam", 0, 0, 10, 10, "#000", 1),
    ).not.toThrow();
  });
});

// ── commitTextToCanvas ────────────────────────────────────────────────────────

describe("commitTextToCanvas", () => {
  it("calls fillText once for single-line text", () => {
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    commitTextToCanvas(canvas, 10, 20, "Hello", "#000000", 2);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it("calls fillText once per line for multi-line text", () => {
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    // "Hello\nWorld" is two lines → two fillText calls
    commitTextToCanvas(canvas, 10, 20, "Hello\nWorld", "#000000", 2);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("does not throw when text is empty or whitespace-only", () => {
    const canvas = makeCanvas();
    // Empty / whitespace text should silently do nothing, not crash
    expect(() => commitTextToCanvas(canvas, 0, 0, "", "#000", 1)).not.toThrow();
    expect(() =>
      commitTextToCanvas(canvas, 0, 0, "   ", "#000", 1),
    ).not.toThrow();
  });

  it("does not throw when canvas is null", () => {
    // canvasRef.current can be null during unmount — guard must catch this
    expect(() =>
      commitTextToCanvas(null, 0, 0, "test", "#000", 1),
    ).not.toThrow();
  });

  it("sets fillStyle to the provided color during drawing", () => {
    // ctx.restore() resets fillStyle after the function returns.
    // Intercept the setter to capture the value at the moment it was written.
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    const capture = interceptSetter(ctx, "fillStyle", "#000000");

    commitTextToCanvas(canvas, 0, 0, "hi", "#abcdef", 2);

    expect(capture.get()).toBe("#abcdef");
  });

  it("applies a font size of 16px when size is 2 (max(12, 2×8)=16)", () => {
    // ctx.restore() resets font after the function returns.
    // Intercept the setter to capture the font string at the moment it was written.
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    const capture = interceptSetter(ctx, "font", "10px sans-serif");

    commitTextToCanvas(canvas, 0, 0, "hi", "#000", 2);

    // size=2 → fontSize = Math.max(12, 2*8) = 16
    expect(capture.get()).toContain("16px");
  });

  it("enforces a minimum font size of 12px when size is 1 (max(12, 1×8)=12)", () => {
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    const capture = interceptSetter(ctx, "font", "10px sans-serif");

    commitTextToCanvas(canvas, 0, 0, "hi", "#000", 1);

    // size=1 → fontSize = Math.max(12, 1*8) = 12 — the minimum floor
    expect(capture.get()).toContain("12px");
  });
});

// ── floodFill ─────────────────────────────────────────────────────────────────

describe("floodFill", () => {
  it("does not throw on a normal canvas with valid coordinates", () => {
    const canvas = makeCanvas(50, 50);
    expect(() => floodFill(canvas, 25, 25, "#ff0000")).not.toThrow();
  });

  it("does not throw when canvas is null", () => {
    expect(() => floodFill(null, 0, 0, "#ff0000")).not.toThrow();
  });

  it("does not throw when coordinates are out of canvas bounds", () => {
    const canvas = makeCanvas(50, 50);
    // Coordinates are clamped inside floodFill — must not throw
    expect(() => floodFill(canvas, -10, -10, "#ff0000")).not.toThrow();
    expect(() => floodFill(canvas, 9999, 9999, "#ff0000")).not.toThrow();
  });

  it("calls putImageData after completing the fill", () => {
    const canvas = makeCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    // putImageData writes the modified pixel buffer back to the canvas —
    // if this isn't called, the fill is computed but never displayed
    floodFill(canvas, 5, 5, "#123456");
    expect(ctx.putImageData).toHaveBeenCalled();
  });

  it("calls getImageData to read pixel data before filling", () => {
    const canvas = makeCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    // floodFill must read current pixel data before deciding which pixels to fill
    floodFill(canvas, 5, 5, "#abcdef");
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 10, 10);
  });
});

// ── applyDrawEvent ────────────────────────────────────────────────────────────

describe("applyDrawEvent", () => {
  let canvas;

  beforeEach(() => {
    canvas = makeCanvas();
  });

  it("does not throw for a pen stroke event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "pen",
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        color: "#000",
        size: 2,
      }),
    ).not.toThrow();
  });

  it("does not throw for an eraser event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "eraser",
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        size: 4,
      }),
    ).not.toThrow();
  });

  it("does not throw for a rect shape event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "rect",
        x0: 5,
        y0: 5,
        x1: 50,
        y1: 50,
        color: "#f00",
        size: 2,
      }),
    ).not.toThrow();
  });

  it("does not throw for a circle shape event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "circle",
        x0: 0,
        y0: 0,
        x1: 40,
        y1: 40,
        color: "#00f",
        size: 1,
      }),
    ).not.toThrow();
  });

  it("does not throw for a line shape event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "line",
        x0: 10,
        y0: 10,
        x1: 90,
        y1: 90,
        color: "#0f0",
        size: 3,
      }),
    ).not.toThrow();
  });

  it("does not throw for a text event", () => {
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "text",
        x: 20,
        y: 30,
        text: "Hello",
        color: "#000",
        size: 2,
      }),
    ).not.toThrow();
  });

  it("does not throw for a fill event", () => {
    expect(() =>
      applyDrawEvent(canvas, { tool: "fill", x: 50, y: 50, color: "#ff0000" }),
    ).not.toThrow();
  });

  it("does not throw when canvas is null", () => {
    // canvasRef.current can be null on unmount — the guard in applyDrawEvent must handle this
    expect(() =>
      applyDrawEvent(null, {
        tool: "pen",
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
        color: "#000",
        size: 1,
      }),
    ).not.toThrow();
  });

  it("restores globalCompositeOperation to source-over after the eraser", () => {
    // The eraser uses destination-out to make pixels transparent.
    // ctx.restore() must bring the composite op back to source-over afterwards
    // so subsequent pen strokes are not accidentally treated as erasers.
    const ctx = canvas.getContext("2d");
    applyDrawEvent(canvas, {
      tool: "eraser",
      x0: 0,
      y0: 0,
      x1: 10,
      y1: 10,
      size: 2,
    });
    expect(ctx.globalCompositeOperation).toBe("source-over");
  });

  it("does not throw for unknown tool types", () => {
    // Future or unknown tools from the server must not crash the client
    expect(() =>
      applyDrawEvent(canvas, {
        tool: "future_tool",
        x0: 0,
        y0: 0,
        x1: 10,
        y1: 10,
      }),
    ).not.toThrow();
  });

  it("calls stroke() when drawing a pen line", () => {
    const ctx = canvas.getContext("2d");
    applyDrawEvent(canvas, {
      tool: "pen",
      x0: 0,
      y0: 0,
      x1: 20,
      y1: 20,
      color: "#000",
      size: 2,
    });
    // stroke() must be called to actually render the line segment to the canvas
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("sets the correct strokeStyle for pen events during drawing", () => {
    // ctx.restore() resets strokeStyle after the function returns.
    // Intercept the setter to capture the value at the moment it was written.
    const ctx = canvas.getContext("2d");
    const capture = interceptSetter(ctx, "strokeStyle", "#000000");

    applyDrawEvent(canvas, {
      tool: "pen",
      x0: 0,
      y0: 0,
      x1: 5,
      y1: 5,
      color: "#ff6600",
      size: 1,
    });

    expect(capture.get()).toBe("#ff6600");
  });
});

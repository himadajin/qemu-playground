import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "qemu-playground:workspace-ratio:v1";
const MIN_PANE_WIDTH = 320;
const DIVIDER_WIDTH = 12;

function readRatio() {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(value) && value > 0 && value < 1) return value;
  } catch {
    // Resizing remains available when browser storage is blocked.
  }
  return 0.5;
}

export function ResizableWorkspace({ code, result }: { code: ReactNode; result: ReactNode }) {
  const workspace = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; offset: number } | null>(null);
  const codeId = useId();
  const [ratio, setRatio] = useState(readRatio);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const available = Math.max(0, width - DIVIDER_WIDTH);
  const minimum = available > 0 ? Math.min(0.5, MIN_PANE_WIDTH / available) : 0.5;
  const displayedRatio = Math.max(minimum, Math.min(1 - minimum, ratio));

  useLayoutEffect(() => {
    const element = workspace.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function resize(leftWidth: number, total: number) {
    if (total < MIN_PANE_WIDTH * 2) return;
    const next = Math.max(MIN_PANE_WIDTH, Math.min(total - MIN_PANE_WIDTH, leftWidth)) / total;
    setRatio(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Keep the current session usable even when preferences cannot be saved.
    }
  }

  return (
    <main ref={workspace} className={`workspace${dragging ? " workspace--resizing" : ""}`}>
      <div
        id={codeId}
        className="workspace__pane workspace__pane--code"
        style={{
          flexBasis: `clamp(320px, calc((100% - ${DIVIDER_WIDTH}px) * ${ratio}), calc(100% - ${DIVIDER_WIDTH + MIN_PANE_WIDTH}px))`,
        }}
      >
        {code}
      </div>
      {/* Mantine has no split-pane control; use a focusable ARIA window splitter. */}
      <div
        className="workspace__divider"
        role="separator"
        tabIndex={0}
        aria-label="Resize code and results"
        aria-orientation="vertical"
        aria-controls={codeId}
        aria-valuemin={Math.round(minimum * 100)}
        aria-valuemax={Math.round((1 - minimum) * 100)}
        aria-valuenow={Math.round(displayedRatio * 100)}
        aria-valuetext={`Code ${Math.round(displayedRatio * 100)}%, results ${Math.round((1 - displayedRatio) * 100)}%`}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          const pane = document.getElementById(codeId);
          if (!pane) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerId: event.pointerId,
            offset: event.clientX - pane.getBoundingClientRect().right,
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          const bounds = workspace.current?.getBoundingClientRect();
          if (!bounds) return;
          resize(event.clientX - bounds.left - drag.current.offset, bounds.width - DIVIDER_WIDTH);
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          resize(available * displayedRatio + (event.key === "ArrowRight" ? 16 : -16), available);
        }}
      />
      <div className="workspace__pane">{result}</div>
    </main>
  );
}

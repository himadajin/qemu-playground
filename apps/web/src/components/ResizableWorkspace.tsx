import { Splitter } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useId, useState, type ReactNode } from "react";

const STORAGE_KEY = "qemu-playground:workspace-ratio:v1";
const MIN_PANE_WIDTH = 320;

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
  const { ref, width } = useElementSize();
  const codeId = useId();
  const [ratio, setRatio] = useState(readRatio);
  // Constrain the rendered split without replacing the user's saved preference.
  const minimum = width > 0 ? Math.min(0.5, MIN_PANE_WIDTH / width) : 0.5;
  const displayedRatio = Math.max(minimum, Math.min(1 - minimum, ratio));

  return (
    <main className="workspace">
      <Splitter
        ref={ref}
        className="workspace__splitter"
        classNames={{ pane: "workspace__pane", handle: "workspace__divider" }}
        sizes={[displayedRatio * 100, (1 - displayedRatio) * 100]}
        onSizeChange={(sizes) => {
          const next = Number(sizes[0]) / 100;
          setRatio(next);
          try {
            window.localStorage.setItem(STORAGE_KEY, String(next));
          } catch {
            // Keep resizing usable when preferences cannot be saved.
          }
        }}
        step="16px"
        shiftStep="16px"
        resetOnDoubleClick={false}
        withHandle={false}
        lineSize={0}
        attributes={{
          handle: {
            "aria-label": "Resize code and results",
            "aria-controls": codeId,
            "aria-valuetext": `Code ${Math.round(displayedRatio * 100)}%, results ${Math.round((1 - displayedRatio) * 100)}%`,
          },
        }}
      >
        <Splitter.Pane id={codeId} defaultSize={50} min="320px">
          {code}
        </Splitter.Pane>
        <Splitter.Pane defaultSize={50} min="320px">
          {result}
        </Splitter.Pane>
      </Splitter>
    </main>
  );
}

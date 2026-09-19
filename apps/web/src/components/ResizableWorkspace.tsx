import { useElementSize, useLocalStorage } from "@mantine/hooks";
import { useId, type ReactNode } from "react";
import { Splitter } from "@mantine/core";
import { ResizableSplit } from "./ResizableSplit";

const STORAGE_KEY = "qemu-playground:workspace-ratio:v1";
const MIN_PANE_WIDTH = 320;

function deserializeRatio(stored: string | undefined) {
  const value = Number(stored);
  return Number.isFinite(value) && value > 0 && value < 1 ? value : 0.5;
}

export function ResizableWorkspace({ code, result }: { code: ReactNode; result: ReactNode }) {
  const { ref, width } = useElementSize();
  const codeId = useId();
  const [ratio, setRatio] = useLocalStorage<number>({
    key: STORAGE_KEY,
    defaultValue: 0.5,
    getInitialValueInEffect: false,
    sync: false,
    serialize: String,
    deserialize: deserializeRatio,
  });
  // Constrain the rendered split without replacing the user's saved preference.
  const minimum = width > 0 ? Math.min(0.5, MIN_PANE_WIDTH / width) : 0.5;
  const displayedRatio = Math.max(minimum, Math.min(1 - minimum, ratio));

  return (
    <main className="workspace">
      <ResizableSplit
        ref={ref}
        className="workspace__splitter"
        sizes={[displayedRatio * 100, (1 - displayedRatio) * 100]}
        onSizeChange={(sizes) => {
          const next = Number(sizes[0]) / 100;
          setRatio(next);
        }}
        ariaLabel="Resize code and results"
        ariaControls={codeId}
        ariaValueText={`Code ${Math.round(displayedRatio * 100)}%, results ${Math.round((1 - displayedRatio) * 100)}%`}
      >
        <Splitter.Pane id={codeId} defaultSize={50} min="320px">
          {code}
        </Splitter.Pane>
        <Splitter.Pane defaultSize={50} min="320px">
          {result}
        </Splitter.Pane>
      </ResizableSplit>
    </main>
  );
}

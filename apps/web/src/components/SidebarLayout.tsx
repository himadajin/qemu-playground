import { useElementSize, useMergedRef, useSplitter, type SplitterPaneSize } from "@mantine/hooks";
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const SIDEBAR_WIDTH_STORAGE_KEY = "qemu-playground:sidebar-width:v1";
export const RESULTS_WIDTH_STORAGE_KEY = "qemu-playground:results-width:v1";
export const DEFAULT_SIDEBAR_WIDTH = 240;
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 420;
export const DEFAULT_RESULTS_WIDTH = 400;
export const MIN_RESULTS_WIDTH = 320;
export const COLLAPSED_SIDEBAR_WIDTH = 44;
const MIN_EDITOR_WIDTH = 320;

type Widths = [number, number];

function readWidth(key: string, fallback: number, min: number, max = Infinity) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, value)) : fallback;
  } catch {
    return fallback;
  }
}

function saveWidth(side: number, value: number) {
  try {
    window.localStorage.setItem(
      side === 0 ? SIDEBAR_WIDTH_STORAGE_KEY : RESULTS_WIDTH_STORAGE_KEY,
      String(value),
    );
  } catch {
    // Keep resizing usable when browser storage is blocked.
  }
}

/** Shrink each sidebar's available slack without changing its preferred width. */
function fitWidths(preferred: Widths, minimums: Widths, containerWidth: number): Widths {
  const slack = preferred[0] - minimums[0] + preferred[1] - minimums[1];
  if (containerWidth <= 0 || slack <= 0) return preferred;
  const available = containerWidth - MIN_EDITOR_WIDTH - minimums[0] - minimums[1];
  const scale = Math.max(0, Math.min(1, available / slack));
  return [
    minimums[0] + (preferred[0] - minimums[0]) * scale,
    minimums[1] + (preferred[1] - minimums[1]) * scale,
  ];
}

interface Props {
  opened: boolean;
  sidebar: ReactNode;
  results?: { opened: boolean; content: ReactNode };
  children: ReactNode;
}

export function SidebarLayout({ opened, sidebar, results, children }: Props) {
  const { ref: sizeRef, width } = useElementSize();
  const [preferred, setPreferred] = useState<Widths>(() => [
    readWidth(
      SIDEBAR_WIDTH_STORAGE_KEY,
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH,
    ),
    readWidth(RESULTS_WIDTH_STORAGE_KEY, DEFAULT_RESULTS_WIDTH, MIN_RESULTS_WIDTH),
  ]);
  const resultMode = results ? (results.opened ? "open" : "closed") : "absent";
  const minimums: Widths = [
    opened ? MIN_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH,
    results ? (results.opened ? MIN_RESULTS_WIDTH : COLLAPSED_SIDEBAR_WIDTH) : 0,
  ];
  const requested: Widths = [
    opened ? preferred[0] : minimums[0],
    results?.opened ? preferred[1] : minimums[1],
  ];
  const [layout, setLayout] = useState(() => ({
    width,
    opened,
    resultMode,
    sizes: fitWidths(requested, minimums, width),
  }));
  // Refit only when space or open panels change. Refitting on each drag update
  // would let a constrained opposite sidebar expand during the drag.
  if (layout.width !== width || layout.opened !== opened || layout.resultMode !== resultMode) {
    setLayout({ width, opened, resultMode, sizes: fitWidths(requested, minimums, width) });
  }
  const [left, right] = layout.sizes;
  const dragging = useRef(false);
  const changed = useRef(false);

  function updateSizes(sizes: SplitterPaneSize[]) {
    const next: Widths = [
      Number.parseFloat(String(sizes[0])),
      results ? Number.parseFloat(String(sizes[2])) : 0,
    ];
    const side = next[0] !== left ? 0 : next[1] !== right ? 1 : null;
    if (side === null || !Number.isFinite(next[side])) return;
    changed.current = true;
    setLayout((current) => ({ ...current, sizes: next }));
    setPreferred((current) => {
      const updated: Widths = [...current];
      updated[side] = next[side];
      return updated;
    });
    if (!dragging.current) saveWidth(side, next[side]);
  }

  // Native splitter listeners outlive a render; always use the current widths.
  const updateSizesRef = useRef(updateSizes);
  useLayoutEffect(() => {
    updateSizesRef.current = updateSizes;
  });
  const onSizeChange = useCallback(
    (sizes: SplitterPaneSize[]) => updateSizesRef.current(sizes),
    [],
  );

  const splitter = useSplitter<HTMLDivElement>({
    sizes: results ? [`${left}px`, 1, `${right}px`] : [`${left}px`, 1],
    panels: [
      {
        defaultSize: `${DEFAULT_SIDEBAR_WIDTH}px`,
        min: `${minimums[0]}px`,
        max: `${opened ? MAX_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH}px`,
      },
      { defaultSize: 1, min: `${MIN_EDITOR_WIDTH}px` },
      ...(results
        ? [
            {
              defaultSize: `${DEFAULT_RESULTS_WIDTH}px` as const,
              min: `${minimums[1]}px` as const,
              ...(!results.opened ? { max: `${COLLAPSED_SIDEBAR_WIDTH}px` as const } : {}),
            },
          ]
        : []),
    ],
    step: "16px",
    shiftStep: "16px",
    resetOnDoubleClick: false,
    onSizeChange,
    onResizeStart: () => {
      dragging.current = true;
      changed.current = false;
    },
    onResizeEnd: (handleIndex, sizes) => {
      if (changed.current) {
        saveWidth(handleIndex, Number.parseFloat(String(sizes[handleIndex === 0 ? 0 : 2])));
      }
      dragging.current = false;
    },
  });
  const ref = useMergedRef(sizeRef, splitter.ref);

  function divider(side: 0 | 1) {
    const props = splitter.getHandleProps({ index: side });
    const expanded = side === 0 ? opened : !!results?.opened;
    const value = side === 0 ? left : right;
    const available =
      width > 0
        ? Math.max(minimums[side], width - MIN_EDITOR_WIDTH - (side === 0 ? right : left))
        : value;
    const max = side === 0 ? Math.min(MAX_SIDEBAR_WIDTH, available) : available;
    const label = side === 0 ? "Files" : "Results";
    return (
      <div
        {...props}
        className="resizable-split__divider"
        hidden={!expanded}
        aria-label={`Resize ${label.toLowerCase()} sidebar`}
        aria-controls={side === 0 ? "desktop-files" : "desktop-results"}
        aria-orientation="vertical"
        aria-valuenow={Math.round(value)}
        aria-valuemin={minimums[side]}
        aria-valuemax={Math.round(max)}
        aria-valuetext={`${label} sidebar ${Math.round(value)} pixels`}
        onKeyDown={(event) => {
          if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const next = event.key === "Home" ? minimums[side] : max;
            updateSizes([`${side === 0 ? next : left}px`, 1, `${side === 1 ? next : right}px`]);
          } else {
            props.onKeyDown(event);
          }
        }}
      />
    );
  }

  return (
    <div
      ref={ref}
      className="program-layout"
      data-resizing={splitter.activeHandle >= 0 || undefined}
    >
      <div className="program-layout__pane" style={{ width: left }}>
        {sidebar}
      </div>
      {divider(0)}
      <div className="program-layout__pane program-layout__editor">{children}</div>
      {results && (
        <>
          {divider(1)}
          <div className="program-layout__pane" style={{ width: right }}>
            {results.content}
          </div>
        </>
      )}
    </div>
  );
}

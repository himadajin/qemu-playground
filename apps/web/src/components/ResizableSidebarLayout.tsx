import { Splitter } from "@mantine/core";
import { useState, type ReactNode } from "react";
import { ResizableSplit } from "./ResizableSplit";

export const SIDEBAR_WIDTH_STORAGE_KEY = "qemu-playground:sidebar-width:v1";
export const DEFAULT_SIDEBAR_WIDTH = 240;
export const MIN_SIDEBAR_WIDTH = 160;
export const MAX_SIDEBAR_WIDTH = 420;
export const COLLAPSED_SIDEBAR_WIDTH = 44;
const MIN_WORKBENCH_WIDTH = 640;

function clampSidebarWidth(value: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
}

function deserializeSidebarWidth(stored: string | undefined) {
  const value = Number(stored);
  return Number.isFinite(value) && value > 0 ? clampSidebarWidth(value) : DEFAULT_SIDEBAR_WIDTH;
}

function readSidebarWidth() {
  try {
    return deserializeSidebarWidth(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? undefined,
    );
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function useSidebarWidth() {
  const [width, setWidth] = useState(readSidebarWidth);

  function updateWidth(next: number) {
    setWidth(next);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Keep the in-memory preference usable when browser storage is blocked.
    }
  }

  return [width, updateWidth] as const;
}

interface Props {
  opened: boolean;
  sidebar: ReactNode;
  children: ReactNode;
}

export function ResizableSidebarLayout({ opened, sidebar, children }: Props) {
  const [width, setWidth] = useSidebarWidth();
  const [resizing, setResizing] = useState(false);
  const displayedWidth = opened ? width : COLLAPSED_SIDEBAR_WIDTH;
  const className = [
    "program-layout__splitter",
    opened ? "" : "program-layout__splitter--collapsed",
    resizing ? "program-layout__splitter--resizing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ResizableSplit
      className={className}
      sizes={[`${displayedWidth}px`, 1]}
      onSizeChange={(sizes) => {
        const next = Number.parseFloat(String(sizes[0]));
        if (Number.isFinite(next)) setWidth(clampSidebarWidth(next));
      }}
      onResizeStart={() => setResizing(true)}
      onResizeEnd={() => setResizing(false)}
      ariaLabel="Resize files sidebar"
      ariaControls="desktop-files"
      ariaValueText={`Files sidebar ${Math.round(displayedWidth)} pixels`}
    >
      <Splitter.Pane
        className="program-layout__sidebar-pane"
        defaultSize={`${DEFAULT_SIDEBAR_WIDTH}px`}
        min={`${opened ? MIN_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH}px`}
        max={`${opened ? MAX_SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH}px`}
      >
        {sidebar}
      </Splitter.Pane>
      <Splitter.Pane
        className="program-layout__workbench-pane"
        defaultSize={1}
        min={`${MIN_WORKBENCH_WIDTH}px`}
      >
        {children}
      </Splitter.Pane>
    </ResizableSplit>
  );
}

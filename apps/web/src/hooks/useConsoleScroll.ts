import { useLayoutEffect, useRef, useState } from "react";
import type { RunRecord } from "./useProgramExecution";

export interface ConsolePosition {
  top: number;
  atBottom: boolean;
  anchor?: { id: string; offset: number };
}
const BOTTOM_TOLERANCE = 24;

/** Anchor to a run rather than a pixel offset when output above the reader changes. */
export function useConsoleScroll(
  fileId: string,
  runs: readonly RunRecord[],
  positions: Map<string, ConsolePosition>,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  useLayoutEffect(() => {
    const element = viewport.current!;
    const body = content.current!;
    function capture() {
      // Hidden mobile tabs and collapsed sidebars have no useful geometry.
      if (!element.clientHeight) return;
      const bottom =
        element.scrollHeight - element.clientHeight - element.scrollTop <= BOTTOM_TOLERANCE;
      const top = element.getBoundingClientRect().top;
      const first = [...body.querySelectorAll<HTMLElement>("[data-run-id]")].find(
        (run) => run.getBoundingClientRect().bottom > top,
      );
      positions.set(fileId, {
        top: element.scrollTop,
        atBottom: bottom,
        anchor: first
          ? { id: first.dataset.runId!, offset: first.getBoundingClientRect().top - top }
          : undefined,
      });
      setAtBottom(bottom);
    }
    function restore() {
      if (!element.clientHeight) return;
      const position = positions.get(fileId);
      if (!position || position.atBottom) {
        element.scrollTop = element.scrollHeight;
      } else if (position.anchor) {
        const anchor = [...body.querySelectorAll<HTMLElement>("[data-run-id]")].find(
          (run) => run.dataset.runId === position.anchor!.id,
        );
        element.scrollTop = anchor
          ? element.scrollTop +
            anchor.getBoundingClientRect().top -
            element.getBoundingClientRect().top -
            position.anchor.offset
          : 0;
      } else {
        element.scrollTop = position.top;
      }
      capture();
    }
    restore();
    element.addEventListener("scroll", capture);
    const observer = new ResizeObserver(restore);
    observer.observe(element);
    observer.observe(body);
    return () => {
      element.removeEventListener("scroll", capture);
      observer.disconnect();
    };
  }, [fileId, runs, positions]);

  function anchorHeader(header: HTMLElement) {
    const element = viewport.current!;
    positions.set(fileId, {
      top: element.scrollTop,
      atBottom: false,
      anchor: {
        id: header.dataset.runId!,
        offset: header.getBoundingClientRect().top - element.getBoundingClientRect().top,
      },
    });
  }
  function jump() {
    const element = viewport.current!;
    element.scrollTop = element.scrollHeight;
    positions.set(fileId, { top: element.scrollTop, atBottom: true });
    setAtBottom(true);
  }
  return { viewport, content, atBottom, anchorHeader, jump };
}

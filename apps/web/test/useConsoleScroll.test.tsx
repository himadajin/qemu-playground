// @vitest-environment jsdom
import "./ui.setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConsoleScroll, type ConsolePosition } from "../src/hooks/useConsoleScroll";
import type { RunRecord } from "../src/hooks/useProgramExecution";

type Row = { id: string; height: number };
function Harness({
  fileId = "a",
  rows,
  positions,
  onFold = () => {},
}: {
  fileId?: string;
  rows: Row[];
  positions: Map<string, ConsolePosition>;
  onFold?: () => void;
}) {
  // Supply deterministic layout geometry: jsdom does not perform CSS layout.
  const {
    viewport: viewportRef,
    content,
    atBottom,
    anchorHeader,
    jump,
  } = useConsoleScroll(fileId, rows as unknown as RunRecord[], positions);
  return (
    <>
      <div
        data-testid="viewport"
        ref={(node) => {
          viewportRef.current = node;
          if (!node) return;
          let top = node.scrollTop;
          Object.defineProperties(node, {
            clientHeight: { configurable: true, get: () => 200 },
            scrollHeight: {
              configurable: true,
              get: () =>
                [...node.querySelectorAll<HTMLElement>("[data-height]")].reduce(
                  (sum, row) => sum + Number(row.dataset.height),
                  0,
                ),
            },
            scrollTop: {
              configurable: true,
              get: () => top,
              set: (value: number) => {
                top = Math.max(0, Math.min(value, node.scrollHeight - node.clientHeight));
              },
            },
            getBoundingClientRect: { configurable: true, value: () => ({ top: 100, bottom: 300 }) },
          });
        }}
      >
        <div ref={content}>
          {rows.map((row) => (
            <article
              key={row.id}
              data-run-id={row.id}
              data-height={row.height}
              ref={(node) => {
                if (!node) return;
                node.getBoundingClientRect = () => {
                  let offset = 0;
                  for (
                    let previous = node.previousElementSibling;
                    previous;
                    previous = previous.previousElementSibling
                  )
                    offset += Number((previous as HTMLElement).dataset.height);
                  const top = 100 + offset - viewportRef.current!.scrollTop;
                  return { top, bottom: top + row.height } as DOMRect;
                };
              }}
            >
              <button
                onClick={(event) => {
                  anchorHeader(event.currentTarget.parentElement!);
                  onFold();
                }}
              >
                {row.id}
              </button>
            </article>
          ))}
        </div>
      </div>
      {!atBottom && <button onClick={jump}>Jump to latest</button>}
    </>
  );
}
function scrollTo(top: number) {
  const node = screen.getByTestId("viewport");
  node.scrollTop = top;
  fireEvent.scroll(node);
  return node;
}

describe("Console reading position", () => {
  it("follows the bottom on append/completion and preserves a reader's position otherwise", () => {
    const positions = new Map<string, ConsolePosition>();
    const rows = [
      { id: "1", height: 400 },
      { id: "2", height: 400 },
    ];
    const mounted = render(<Harness rows={rows} positions={positions} />);
    const viewport = screen.getByTestId("viewport");
    expect(viewport.scrollTop).toBe(600);
    mounted.rerender(<Harness rows={[...rows, { id: "3", height: 100 }]} positions={positions} />);
    expect(viewport.scrollTop).toBe(700);
    scrollTo(450);
    expect(screen.getByRole("button", { name: "Jump to latest" })).toBeVisible();
    mounted.rerender(
      <Harness
        rows={[{ id: "1", height: 600 }, rows[1]!, { id: "3", height: 500 }]}
        positions={positions}
      />,
    );
    expect(viewport.scrollTop).toBe(650);
    fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(viewport.scrollTop).toBe(1300);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  });

  it("restores file positions after switching and advances to the oldest survivor on eviction", () => {
    const positions = new Map<string, ConsolePosition>();
    const rows = [
      { id: "1", height: 400 },
      { id: "2", height: 400 },
      { id: "3", height: 400 },
    ];
    const mounted = render(<Harness key="a" rows={rows} positions={positions} />);
    scrollTo(450);
    mounted.rerender(<Harness key="b" fileId="b" rows={rows} positions={positions} />);
    scrollTo(200);
    mounted.rerender(<Harness key="a" rows={rows} positions={positions} />);
    expect(screen.getByTestId("viewport").scrollTop).toBe(450);
    mounted.rerender(<Harness key="a" rows={rows.slice(1)} positions={positions} />);
    expect(screen.getByTestId("viewport").scrollTop).toBe(50);
    mounted.rerender(<Harness key="a" rows={rows.slice(2)} positions={positions} />);
    expect(screen.getByTestId("viewport").scrollTop).toBe(0);
    expect(positions.get("b")?.top).toBe(200);
  });

  it("anchors a manually folded header even when previously following the bottom", () => {
    const positions = new Map<string, ConsolePosition>();
    const rows = [
      { id: "1", height: 400 },
      { id: "2", height: 400 },
      { id: "3", height: 400 },
    ];
    const mounted = render(<Harness rows={rows} positions={positions} />);
    scrollTo(450);
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    mounted.rerender(
      <Harness rows={[rows[0]!, { id: "2", height: 40 }, rows[2]!]} positions={positions} />,
    );
    expect(screen.getByTestId("viewport").scrollTop).toBe(450);
  });
});

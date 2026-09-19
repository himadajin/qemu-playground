import { useRef, useState, type HTMLAttributes } from "react";
import { reorderFiles, type ProgramFile } from "../lib/files";

export type ReorderHandleProps = Pick<
  HTMLAttributes<HTMLButtonElement>,
  "onKeyDown" | "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onBlur"
>;

interface Move {
  id: string;
  ids: string[];
}

export function useFileReorder(files: ProgramFile[], onReorder: (ids: string[]) => void) {
  const [drag, setDrag] = useState<Move | null>(null);
  // Event handlers need the latest move even before React renders the updated order.
  const draft = useRef<Move | null>(null);
  const [announcement, announce] = useState("");

  function start(file: ProgramFile) {
    draft.current = { id: file.id, ids: files.map((item) => item.id) };
    setDrag(draft.current);
    announce(`Moving ${file.name}. Use arrow keys to move, Space to confirm, Escape to cancel.`);
  }

  function move(overId: string) {
    const current = draft.current;
    if (!current || current.id === overId) return;
    const next = reorderFiles(files, current.ids);
    const from = next.findIndex((file) => file.id === current.id);
    const to = next.findIndex((file) => file.id === overId);
    if (from < 0 || to < 0) return;
    const [file] = next.splice(from, 1);
    next.splice(to, 0, file!);
    draft.current = { ...current, ids: next.map((item) => item.id) };
    setDrag(draft.current);
    announce(`${file!.name}, position ${to + 1} of ${next.length}.`);
  }

  function finish(cancel = false) {
    const current = draft.current;
    if (!current) return;
    draft.current = null;
    setDrag(null);
    if (!cancel) onReorder(current.ids);
    announce(cancel ? "Reordering canceled." : "File order updated.");
  }

  function getHandleProps(file: ProgramFile): ReorderHandleProps {
    return {
      onKeyDown(event) {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          if (draft.current) finish();
          else start(file);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          finish(true);
        }
        if (draft.current && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          const current = draft.current;
          const ordered = reorderFiles(files, current.ids);
          const index = ordered.findIndex((item) => item.id === current.id);
          if (index < 0) return;
          const over = ordered[index + (event.key === "ArrowUp" ? -1 : 1)];
          if (over) move(over.id);
        }
      },
      onPointerDown(event) {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start(file);
      },
      onPointerMove(event) {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const over = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-file-id]");
        if (over?.dataset.fileId) move(over.dataset.fileId);
      },
      onPointerUp: () => finish(),
      onPointerCancel: () => finish(true),
      onBlur: () => finish(),
    };
  }

  return {
    files: drag ? reorderFiles(files, drag.ids) : files,
    movingId: drag?.id ?? null,
    announcement,
    getHandleProps,
    finish,
  };
}

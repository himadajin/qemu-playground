import { ActionIcon, Button, Menu, Text, VisuallyHidden } from "@mantine/core";
import { IconDots, IconGripVertical, IconPlus, IconUpload } from "@tabler/icons-react";
import { getTargetDefinition } from "@qemu-playground/shared";
import { useRef, useState } from "react";
import type { ProgramFile } from "../lib/files";

type FileAction = "rename" | "duplicate" | "download" | "delete";
interface Props {
  files: ProgramFile[];
  selectedId: string | null;
  runningId: string | null;
  preview: ProgramFile | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onAction: (action: FileAction, file: ProgramFile) => void;
  onReorder: (files: ProgramFile[]) => void;
}
export function FileSidebar(props: Props) {
  const [reorderMode, setReorderMode] = useState(false);
  const [drag, setDrag] = useState<{ id: string; files: ProgramFile[] } | null>(null);
  const draft = useRef<typeof drag>(null);
  const [announcement, announce] = useState("");
  const files = drag?.files ?? props.files;
  function start(file: ProgramFile) {
    const next = { id: file.id, files: props.files };
    draft.current = next;
    setDrag(next);
    announce(`Moving ${file.name}. Use arrow keys to move, Space to confirm, Escape to cancel.`);
  }
  function move(overId: string) {
    const current = draft.current;
    if (!current || current.id === overId) return;
    const next = [...current.files];
    const from = next.findIndex((file) => file.id === current.id);
    const to = next.findIndex((file) => file.id === overId);
    if (from < 0 || to < 0) return;
    const [file] = next.splice(from, 1);
    next.splice(to, 0, file!);
    draft.current = { ...current, files: next };
    setDrag(draft.current);
    announce(`${file!.name}, position ${to + 1} of ${next.length}.`);
  }
  function finish(cancel = false) {
    if (!draft.current) return;
    if (!cancel) props.onReorder(draft.current.files);
    draft.current = null;
    setDrag(null);
    announce(cancel ? "Reordering canceled." : "File order updated.");
  }
  return (
    <nav className={`files${reorderMode ? " files--reordering" : ""}`} aria-label="Files">
      <div className="files__heading">
        <Text size="xs" fw={600}>
          Files
        </Text>
        <Text size="xs" c="dimmed">
          {props.files.length}
        </Text>
      </div>
      <div className="files__tools">
        <Button
          size="xs"
          variant="default"
          leftSection={<IconPlus size={14} />}
          onClick={props.onNew}
        >
          New
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconUpload size={14} />}
          onClick={props.onImport}
        >
          Import
        </Button>
      </div>
      {props.preview && (
        <div className="files__preview">
          <button
            className="file__select"
            aria-current={props.selectedId === props.preview.id ? "page" : undefined}
            onClick={() => props.onSelect(props.preview!.id)}
          >
            Shared preview
          </button>
          <Text size="xs" c="dimmed">
            Not saved
          </Text>
        </div>
      )}
      <div className="files__list">
        {files.map((file) => (
          <div
            key={file.id}
            data-file-id={file.id}
            className={`file${props.selectedId === file.id ? " file--selected" : ""}${drag?.id === file.id ? " file--moving" : ""}`}
          >
            <ActionIcon
              className="file__handle"
              variant="subtle"
              color="gray"
              size="xs"
              aria-label={`Reorder ${file.name}`}
              aria-pressed={drag?.id === file.id}
              onKeyDown={(event) => {
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
                  const index = current.files.findIndex((item) => item.id === file.id);
                  const over = current.files[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (over) move(over.id);
                }
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                start(file);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const over = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>("[data-file-id]");
                if (over?.dataset.fileId) move(over.dataset.fileId);
              }}
              onPointerUp={() => finish()}
              onPointerCancel={() => finish(true)}
              onBlur={() => finish()}
            >
              <IconGripVertical size={13} />
            </ActionIcon>
            <button
              className="file__select"
              aria-current={props.selectedId === file.id ? "page" : undefined}
              onClick={() => props.onSelect(file.id)}
              title={file.name}
            >
              <span className="file__name">{file.name}</span>
              {file.language === "asm" && (
                <span className="file__arch">{getTargetDefinition(file.target).displayName}</span>
              )}
              {props.runningId === file.id && (
                <span className="file__running" aria-label="Running" />
              )}
            </button>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  className="file__menu"
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={`Actions for ${file.name}`}
                >
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => props.onAction("rename", file)}>Rename</Menu.Item>
                <Menu.Item onClick={() => props.onAction("duplicate", file)}>Duplicate</Menu.Item>
                <Menu.Item onClick={() => props.onAction("download", file)}>Download</Menu.Item>
                <Menu.Item onClick={() => setReorderMode(true)}>Reorder files</Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  disabled={props.runningId === file.id}
                  onClick={() => props.onAction("delete", file)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        ))}
        {!files.length && (
          <Text size="xs" c="dimmed" p="sm">
            No files yet. Create or import a program.
          </Text>
        )}
      </div>
      {reorderMode && (
        <div className="files__reorder">
          <Text size="xs" c="dimmed">
            Drag a handle to reorder.
          </Text>
          <Button
            size="xs"
            variant="default"
            onClick={() => {
              finish();
              setReorderMode(false);
            }}
          >
            Done
          </Button>
        </div>
      )}
      <div className="files__footer">Saved in this browser</div>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </nav>
  );
}

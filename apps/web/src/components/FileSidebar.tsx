import { Button, Group, NavLink, Stack, Text, VisuallyHidden } from "@mantine/core";
import { useState } from "react";
import { FileSidebarItem } from "./FileSidebarItem";
import type { FileAction } from "./FileActionsMenu";
import { useFileReorder } from "../hooks/useFileReorder";
import type { ProgramFile } from "../lib/files";

interface Props {
  files: ProgramFile[];
  selectedId: string | null;
  runningId: string | null;
  preview: ProgramFile | null;
  onSelect: (id: string) => void;
  onAction: (action: FileAction, file: ProgramFile) => void;
  onReorder: (ids: string[]) => void;
}
export function FileSidebar(props: Props) {
  const [reorderMode, setReorderMode] = useState(false);
  const { files, movingId, announcement, getHandleProps, finish } = useFileReorder(
    props.files,
    props.onReorder,
  );
  return (
    <Stack
      component="nav"
      gap={0}
      h="100%"
      mih={0}
      className={reorderMode ? "files--reordering" : undefined}
      aria-label="Files"
    >
      <Text size="xs" fw={600} pt={14} px={16} pb={8}>
        Files
      </Text>
      {props.preview && (
        <div className="files__preview">
          <NavLink
            component="button"
            className="file__select"
            active={props.selectedId === props.preview.id}
            aria-label="Shared preview"
            aria-current={props.selectedId === props.preview.id ? "page" : undefined}
            onClick={() => props.onSelect(props.preview!.id)}
            label={
              <Text component="span" size="xs">
                Shared preview
              </Text>
            }
            description="Not saved"
            color="gray"
            variant="subtle"
          />
        </div>
      )}
      <div className="files__list">
        {files.map((file) => (
          <FileSidebarItem
            key={file.id}
            file={file}
            selected={props.selectedId === file.id}
            running={props.runningId === file.id}
            moving={movingId === file.id}
            reorderHandleProps={getHandleProps(file)}
            onSelect={() => props.onSelect(file.id)}
            onAction={(action) => props.onAction(action, file)}
            onReorder={() => setReorderMode(true)}
          />
        ))}
        {!files.length && (
          <Text size="xs" c="dimmed" p="sm">
            No files yet. Create or import a program.
          </Text>
        )}
      </div>
      {reorderMode && (
        <Group p={12} gap={8} justify="space-between" wrap="nowrap">
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
        </Group>
      )}
      <Text py={12} px={16} size="11px" c="dimmed">
        Saved in this browser
      </Text>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
    </Stack>
  );
}

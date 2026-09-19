import { ActionIcon, Group, NavLink, Text } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { getTargetDefinition } from "@qemu-playground/shared";
import type { ProgramFile } from "../lib/files";
import type { ReorderHandleProps } from "../hooks/useFileReorder";
import { FileActionsMenu, type FileAction } from "./FileActionsMenu";

interface Props {
  file: Pick<ProgramFile, "id" | "name" | "language" | "target">;
  selected: boolean;
  running: boolean;
  moving: boolean;
  reorderHandleProps: ReorderHandleProps;
  onSelect: () => void;
  onAction: (action: FileAction) => void;
  onReorder: () => void;
}

export function FileSidebarItem({
  file,
  selected,
  running,
  moving,
  reorderHandleProps,
  onSelect,
  onAction,
  onReorder,
}: Props) {
  return (
    <div
      data-file-id={file.id}
      className={`file${selected ? " file--selected" : ""}${moving ? " file--moving" : ""}`}
    >
      <ActionIcon
        className="file__handle"
        variant="subtle"
        color="gray"
        size="xs"
        aria-label={`Reorder ${file.name}`}
        aria-pressed={moving}
        {...reorderHandleProps}
      >
        <IconGripVertical size={13} />
      </ActionIcon>
      <NavLink
        component="button"
        className="file__select"
        active={selected}
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
        title={file.name}
        color="gray"
        variant="subtle"
        noWrap
        label={
          <Text component="span" size="xs" fw={selected ? 600 : undefined} truncate>
            {file.name}
          </Text>
        }
        rightSection={
          file.language === "asm" || running ? (
            <Group component="span" gap={6} wrap="nowrap">
              {file.language === "asm" && (
                <Text component="span" size="10px" c="dimmed">
                  {getTargetDefinition(file.target).displayName}
                </Text>
              )}
              {running && <span className="file__running" aria-label="Running" />}
            </Group>
          ) : undefined
        }
      />

      <FileActionsMenu
        filename={file.name}
        canDelete={!running}
        onAction={onAction}
        onReorder={onReorder}
      />
    </div>
  );
}

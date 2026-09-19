import { ActionIcon, Stack, Tooltip } from "@mantine/core";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlus,
} from "@tabler/icons-react";
import { ImportSourceButton } from "./ImportSourceButton";

interface Props {
  opened: boolean;
  onToggle: () => void;
  onNew: () => void;
  onImport: (file: File) => void;
}

export function FileSidebarRail({ opened, onToggle, onNew, onImport }: Props) {
  const toggleLabel = opened ? "Hide files" : "Show files";
  return (
    <Stack w={44} align="center" gap={8} py={8} style={{ flexShrink: 0 }}>
      <Tooltip
        label={toggleLabel}
        position="right"
        events={{ hover: true, focus: true, touch: false }}
        interactive
      >
        <ActionIcon
          size={32}
          variant="subtle"
          color="gray"
          aria-label={toggleLabel}
          aria-expanded={opened}
          aria-controls="desktop-files"
          onClick={onToggle}
        >
          {opened ? (
            <IconLayoutSidebarLeftCollapse size={18} />
          ) : (
            <IconLayoutSidebarLeftExpand size={18} />
          )}
        </ActionIcon>
      </Tooltip>
      <Tooltip
        label="New"
        position="right"
        events={{ hover: true, focus: true, touch: false }}
        interactive
      >
        <ActionIcon size={32} variant="subtle" color="gray" aria-label="New" onClick={onNew}>
          <IconPlus size={18} />
        </ActionIcon>
      </Tooltip>
      <ImportSourceButton iconOnly onImport={onImport} />
    </Stack>
  );
}

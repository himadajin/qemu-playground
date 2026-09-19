import { Stack, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { ImportSourceButton } from "./ImportSourceButton";
import { SidebarToggle } from "./Sidebar";

interface Props {
  opened: boolean;
  drawer?: boolean;
  onToggle: () => void;
  onNew: () => void;
  onImport: (file: File) => void;
}

export function FileSidebarRail({ opened, drawer = false, onToggle, onNew, onImport }: Props) {
  const toggleLabel = drawer ? "Close sidebar" : opened ? "Collapse sidebar" : "Expand sidebar";
  return (
    <Stack className="sidebar__actions" gap={8}>
      <SidebarToggle
        opened={opened}
        label={toggleLabel}
        controls={drawer ? "drawer-files" : "desktop-files"}
        onToggle={onToggle}
      />
      <Tooltip
        label="New file"
        disabled={opened}
        position="right"
        events={{ hover: true, focus: true, touch: false }}
      >
        <UnstyledButton className="sidebar__action" aria-label="New file" onClick={onNew}>
          <span className="sidebar__icon">
            <IconPlus size={18} />
          </span>
          <span className="sidebar__label" aria-hidden="true">
            New file
          </span>
        </UnstyledButton>
      </Tooltip>
      <ImportSourceButton sidebarExpanded={opened} onImport={onImport} />
    </Stack>
  );
}

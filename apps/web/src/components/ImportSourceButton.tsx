import { Button, FileButton, Tooltip, UnstyledButton } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { useRef } from "react";

export function ImportSourceButton({
  onImport,
  inEmptyState = false,
  sidebarExpanded,
}: {
  onImport: (file: File) => void;
  inEmptyState?: boolean;
  sidebarExpanded?: boolean;
}) {
  const resetRef = useRef<() => void>(null);
  return (
    <FileButton
      accept=".c,.s"
      resetRef={resetRef}
      inputProps={{ "aria-label": "Import source file" }}
      onChange={(file) => {
        resetRef.current?.();
        if (file) onImport(file);
      }}
    >
      {(props) =>
        sidebarExpanded !== undefined ? (
          <Tooltip
            label="Import files"
            disabled={sidebarExpanded}
            position="right"
            events={{ hover: true, focus: true, touch: false }}
          >
            <UnstyledButton {...props} className="sidebar__action" aria-label="Import files">
              <span className="sidebar__icon">
                <IconUpload size={18} />
              </span>
              <span className="sidebar__label" aria-hidden="true">
                Import files
              </span>
            </UnstyledButton>
          </Tooltip>
        ) : (
          <Button
            {...props}
            size="xs"
            variant={inEmptyState ? "default" : "subtle"}
            color={inEmptyState ? undefined : "gray"}
            leftSection={inEmptyState ? undefined : <IconUpload size={14} />}
          >
            {inEmptyState ? "Import source" : "Import"}
          </Button>
        )
      }
    </FileButton>
  );
}

import { ActionIcon, Button, FileButton, Tooltip } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { useRef } from "react";

export function ImportSourceButton({
  onImport,
  inEmptyState = false,
  iconOnly = false,
}: {
  onImport: (file: File) => void;
  inEmptyState?: boolean;
  iconOnly?: boolean;
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
        iconOnly ? (
          <Tooltip
            label="Import"
            position="right"
            events={{ hover: true, focus: true, touch: false }}
            interactive
          >
            <ActionIcon {...props} size={32} variant="subtle" color="gray" aria-label="Import">
              <IconUpload size={18} />
            </ActionIcon>
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

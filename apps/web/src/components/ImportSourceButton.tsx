import { Button, FileButton } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { useRef } from "react";

export function ImportSourceButton({
  onImport,
  inEmptyState = false,
}: {
  onImport: (file: File) => void;
  inEmptyState?: boolean;
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
      {(props) => (
        <Button
          {...props}
          size="xs"
          variant={inEmptyState ? "default" : "subtle"}
          color={inEmptyState ? undefined : "gray"}
          leftSection={inEmptyState ? undefined : <IconUpload size={14} />}
        >
          {inEmptyState ? "Import source" : "Import"}
        </Button>
      )}
    </FileButton>
  );
}

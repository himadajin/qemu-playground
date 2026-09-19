import { Button, CloseButton } from "@mantine/core";
export function PreviewBanner({
  running,
  onSave,
  onClose,
}: {
  running: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="preview-banner">
      <div>
        <strong>Shared preview</strong>
        <span>Not saved in your files</span>
      </div>
      <Button size="xs" variant="default" onClick={onSave}>
        Add to files
      </Button>
      <CloseButton
        variant="subtle"
        iconSize={15}
        aria-label="Close preview"
        disabled={running}
        onClick={onClose}
      />
    </div>
  );
}

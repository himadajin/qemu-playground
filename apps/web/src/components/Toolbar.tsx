import { useRef } from "react";
import { Button, Alert, Group, Popover, Text, VisuallyHidden } from "@mantine/core";
import { ThemeMenu } from "./ThemeMenu";
export interface ToolbarNotice {
  tone: "info" | "error";
  text: string;
}
export function Toolbar({
  onShare,
  notice,
  onDismiss,
  disabled,
}: {
  onShare: () => void;
  notice: ToolbarNotice | null;
  onDismiss: () => void;
  disabled: boolean;
}) {
  return (
    <header className="toolbar">
      <Text fw={600} size="sm" className="toolbar__brand">
        QEMU Playground
      </Text>
      <Group gap="xs" className="toolbar__actions">
        <FeedbackButton
          onClick={onShare}
          notice={notice}
          onDismiss={onDismiss}
          disabled={disabled}
        />
        <ThemeMenu />
      </Group>
    </header>
  );
}
function FeedbackButton({
  disabled,
  onClick,
  notice,
  onDismiss,
}: {
  disabled?: boolean;
  onClick: () => void;
  notice: ToolbarNotice | null;
  onDismiss: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const success = notice?.tone === "info";
  const error = notice?.tone === "error";

  const closeError = () => {
    onDismiss();
    buttonRef.current?.focus();
  };

  return (
    <>
      <Popover
        opened={error}
        position="bottom-end"
        withArrow
        withinPortal={false}
        shadow="sm"
        width={300}
        closeOnClickOutside={false}
        onDismiss={closeError}
        transitionProps={{ duration: 0 }}
      >
        <Popover.Target>
          <Button
            disabled={disabled}
            ref={buttonRef}
            size="xs"
            variant="default"
            onClick={onClick}
            onKeyDown={(event) => {
              if (error && event.key === "Escape") {
                event.preventDefault();
                closeError();
              }
            }}
          >
            <span className="toolbar__feedback-label">
              <span style={{ visibility: success ? "hidden" : "visible" }}>Share</span>
              <span style={{ visibility: success ? "visible" : "hidden" }}>
                <span aria-hidden="true">✓ </span>
                Copied
              </span>
            </span>
          </Button>
        </Popover.Target>
        <Popover.Dropdown className="toolbar__error">
          <Alert
            variant="transparent"
            color="red"
            p={0}
            withCloseButton
            closeButtonLabel="Dismiss share error"
            onClose={closeError}
            styles={{
              message: { fontSize: "var(--mantine-font-size-xs)", overflowWrap: "anywhere" },
            }}
          >
            {error ? notice.text : null}
          </Alert>
        </Popover.Dropdown>
      </Popover>
      <VisuallyHidden role="status">{success ? notice.text : ""}</VisuallyHidden>
    </>
  );
}

import { useEffect, useRef } from "react";
import {
  Button,
  CloseButton,
  Group,
  Popover,
  SegmentedControl,
  Select,
  Text,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import { TARGETS, type Language, type TargetId } from "@qemu-playground/shared";

export interface ToolbarNotice {
  tone: "info" | "error";
  text: string;
}

interface ToolbarProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  target: TargetId;
  onTargetChange: (target: TargetId) => void;
  compileOptions: string;
  onCompileOptionsChange: (value: string) => void;
  running: boolean;
  onRun: () => void;
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
  notices: Record<"share" | "save", ToolbarNotice | null>;
  onDismissNotice: (action: "share" | "save") => void;
}

export function Toolbar({
  language,
  onLanguageChange,
  target,
  onTargetChange,
  compileOptions,
  onCompileOptionsChange,
  running,
  onRun,
  onOpen,
  onSave,
  onShare,
  notices,
  onDismissNotice,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <Text fw={600} size="sm" className="toolbar__brand">
        QEMU Playground
      </Text>
      <SegmentedControl
        size="xs"
        aria-label="Language"
        value={language}
        onChange={(value) => onLanguageChange(value)}
        data={[
          { value: "c", label: "C" },
          { value: "asm", label: "Assembly" },
        ]}
      />
      <Select
        size="xs"
        className="toolbar__target"
        aria-label="Target"
        value={target}
        allowDeselect={false}
        data={TARGETS.map(({ id, displayName }) => ({ value: id, label: displayName }))}
        onChange={(value) => {
          if (value !== null) onTargetChange(value);
        }}
      />
      <TextInput
        size="xs"
        className="toolbar__options"
        placeholder="-O2"
        spellCheck={false}
        autoComplete="off"
        aria-label="Compile options"
        value={compileOptions}
        onChange={(event) => onCompileOptionsChange(event.currentTarget.value)}
      />
      <Button
        size="xs"
        onClick={onRun}
        loading={running}
        disabled={running}
        aria-label={running ? "Running" : "Run"}
        aria-busy={running}
      >
        {running ? "Running" : "Run"}
      </Button>
      <Group gap="xs" className="toolbar__actions">
        <Button size="xs" variant="default" onClick={onOpen}>
          Open
        </Button>
        <FeedbackButton
          action="save"
          onClick={onSave}
          notice={notices.save}
          onDismiss={onDismissNotice}
        />
        <FeedbackButton
          action="share"
          onClick={onShare}
          notice={notices.share}
          onDismiss={onDismissNotice}
        />
      </Group>
    </header>
  );
}

function FeedbackButton({
  action,
  onClick,
  notice,
  onDismiss,
}: {
  action: "share" | "save";
  onClick: () => void;
  notice: ToolbarNotice | null;
  onDismiss: (action: "share" | "save") => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = action === "share" ? "Share" : "Save";
  const successLabel = action === "share" ? "Copied" : "Saved";
  const success = notice?.tone === "info";
  const error = notice?.tone === "error";

  useEffect(() => {
    if (notice?.tone !== "info") return;
    const timer = setTimeout(() => onDismiss(action), 2000);
    return () => clearTimeout(timer);
  }, [notice, action, onDismiss]);

  const closeError = () => {
    onDismiss(action);
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
              <span style={{ visibility: success ? "hidden" : "visible" }}>{label}</span>
              <span style={{ visibility: success ? "visible" : "hidden" }}>
                <span aria-hidden="true">✓ </span>
                {successLabel}
              </span>
            </span>
          </Button>
        </Popover.Target>
        <Popover.Dropdown className="toolbar__error">
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <Text size="xs" role="alert" className="toolbar__error-text">
              {error ? notice.text : null}
            </Text>
            <CloseButton size="sm" aria-label={`Dismiss ${action} error`} onClick={closeError} />
          </Group>
        </Popover.Dropdown>
      </Popover>
      <VisuallyHidden role="status">{success ? notice.text : ""}</VisuallyHidden>
    </>
  );
}

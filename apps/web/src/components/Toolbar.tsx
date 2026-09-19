import { Button, Group, SegmentedControl, Select, Text, TextInput } from "@mantine/core";
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
  notice: ToolbarNotice | null;
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
  notice,
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
        <Button size="xs" variant="default" onClick={onSave}>
          Save
        </Button>
        <Button size="xs" variant="default" onClick={onShare}>
          Share
        </Button>
      </Group>
      {notice !== null && (
        <Text
          size="xs"
          c={notice.tone === "error" ? "red" : "dimmed"}
          className="toolbar__notice"
          role="status"
        >
          {notice.text}
        </Text>
      )}
    </header>
  );
}

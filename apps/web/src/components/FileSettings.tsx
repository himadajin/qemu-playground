import { Group, NativeSelect, Text, TextInput } from "@mantine/core";
import { TARGETS, getTargetDefinition, type TargetId } from "@qemu-playground/shared";
import type { ProgramFile } from "../lib/files";
export function FileSettings({
  file,
  onChange,
}: {
  file: ProgramFile;
  onChange: (patch: Partial<Pick<ProgramFile, "target" | "compileOptions">>) => void;
}) {
  return (
    <Group className="file-settings" gap={10} py={10} px={12}>
      <Text size="xs" fw={600} truncate flex={1} miw={70} title={file.name}>
        {file.name}
      </Text>
      {file.language === "c" ? (
        <NativeSelect
          size="xs"
          aria-label="Target"
          value={file.target}
          data={TARGETS.map((item) => ({ value: item.id, label: item.displayName }))}
          onChange={(event) => onChange({ target: event.currentTarget.value as TargetId })}
        />
      ) : (
        <Text size="xs" c="dimmed">
          {getTargetDefinition(file.target).displayName}
        </Text>
      )}
      <TextInput
        className="file-settings__options"
        size="xs"
        aria-label="Compile options"
        placeholder="-O2"
        spellCheck={false}
        autoComplete="off"
        value={file.compileOptions}
        onChange={(event) => onChange({ compileOptions: event.currentTarget.value })}
      />
    </Group>
  );
}

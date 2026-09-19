import { Button, Group, Modal, NativeSelect, Stack, TextInput } from "@mantine/core";
import { TARGETS, type Language, type TargetId } from "@qemu-playground/shared";
import { useState } from "react";
import { filename, type ProgramFile } from "../lib/files";
export interface FileDraft {
  mode: "new" | "import" | "rename" | "add";
  file: ProgramFile;
}
export function FileDialog({
  draft,
  files,
  onClose,
  onSubmit,
}: {
  draft: FileDraft;
  files: ProgramFile[];
  onClose: () => void;
  onSubmit: (file: ProgramFile) => void;
}) {
  const [name, setName] = useState(draft.file.name.slice(0, -2));
  const [language, setLanguage] = useState<Language>(draft.file.language);
  const [target, setTarget] = useState<TargetId>(draft.file.target);
  const [error, setError] = useState<string | null>(null);
  const title = {
    new: "New file",
    import: "Import source",
    rename: "Rename file",
    add: "Add to files",
  }[draft.mode];
  return (
    <Modal opened onClose={onClose} title={title} centered size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const normalized = filename(name, language);
          if (!name.trim()) {
            setError("Enter a filename.");
            return;
          }
          if (
            files.some(
              (file) =>
                file.name === normalized && (draft.mode !== "rename" || file.id !== draft.file.id),
            )
          ) {
            setError("A file with this name already exists.");
            return;
          }
          onSubmit({ ...draft.file, name: normalized, language, target });
        }}
      >
        <Stack gap="md">
          <TextInput
            data-autofocus
            label="Filename"
            value={name}
            rightSection={language === "c" ? ".c" : ".s"}
            error={error}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
          {draft.mode === "new" && (
            <NativeSelect
              label="Program type"
              value={language === "c" ? "c" : target}
              data={[
                { value: "c", label: "C" },
                ...TARGETS.map((item) => ({
                  value: item.id,
                  label: `Assembly (${item.displayName})`,
                })),
              ]}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setLanguage(value === "c" ? "c" : "asm");
                setTarget(value === "c" ? "rv64" : (value as TargetId));
              }}
            />
          )}
          {draft.mode === "import" && language === "asm" && (
            <NativeSelect
              label="Assembly architecture"
              required
              defaultValue=""
              data={[
                { value: "", label: "Choose an architecture", disabled: true },
                ...TARGETS.map((item) => ({ value: item.id, label: item.displayName })),
              ]}
              onChange={(event) => setTarget(event.currentTarget.value as TargetId)}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{title}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

import { getTargetDefinition } from "@qemu-playground/shared";
import { Button, Dialog, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { SavedSnippet } from "../lib/storage";

const LANGUAGE_LABEL = { c: "C", asm: "Assembly" } as const;

interface SaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => void;
}

/** Save is a name prompt and nothing more; storage stays out of the way. */
export function SaveDialog({ open, onOpenChange, defaultName, onSave }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);

  // Reset the field to the current default whenever the dialog (re)opens or
  // the default itself changes while open, mirroring what a
  // `[open, defaultName]`-keyed effect would do, but adjusted during render
  // instead of in a post-commit effect.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevDefaultName, setPrevDefaultName] = useState(defaultName);
  if (open !== prevOpen || defaultName !== prevDefaultName) {
    setPrevOpen(open);
    setPrevDefaultName(defaultName);
    if (open) {
      setName(defaultName);
    }
  }

  const trimmed = name.trim();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="1" maxWidth="380px">
        <Dialog.Title size="3">Save snippet</Dialog.Title>
        <Dialog.Description size="1" color="gray" mb="3">
          Stored in this browser only. Saving under an existing name replaces it.
        </Dialog.Description>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed !== "") {
              onSave(trimmed);
            }
          }}
        >
          <TextField.Root
            size="1"
            autoFocus
            placeholder="Snippet name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Flex gap="2" justify="end" mt="3">
            <Dialog.Close>
              <Button size="1" variant="surface" color="gray" type="button">
                Cancel
              </Button>
            </Dialog.Close>
            <Button size="1" type="submit" disabled={trimmed === ""}>
              Save
            </Button>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

interface OpenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippets: SavedSnippet[];
  onSelect: (snippet: SavedSnippet) => void;
  onDelete: (snippet: SavedSnippet) => void;
}

/** Open lists the saved snippets on demand; there is no permanent file tree. */
export function OpenDialog({ open, onOpenChange, snippets, onSelect, onDelete }: OpenDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="1" maxWidth="420px">
        <Dialog.Title size="3">Open snippet</Dialog.Title>
        <Dialog.Description size="1" color="gray" mb="3">
          Saved in this browser.
        </Dialog.Description>

        {snippets.length === 0 ? (
          <Text size="1" color="gray">
            Nothing saved yet.
          </Text>
        ) : (
          <ul className="snippet-list">
            {snippets.map((snippet) => (
              <li key={snippet.id} className="snippet-list__row">
                <button
                  type="button"
                  className="snippet-list__open"
                  onClick={() => onSelect(snippet)}
                >
                  <span className="snippet-list__name">{snippet.name}</span>
                  <span className="snippet-list__meta">
                    {LANGUAGE_LABEL[snippet.language]} ·{" "}
                    {getTargetDefinition(snippet.target).displayName}
                  </span>
                </button>
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  aria-label={`Delete ${snippet.name}`}
                  onClick={() => onDelete(snippet)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <Flex justify="end" mt="3">
          <Dialog.Close>
            <Button size="1" variant="surface" color="gray">
              Close
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

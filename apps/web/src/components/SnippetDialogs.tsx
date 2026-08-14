import { getTargetDefinition } from "@qemu-playground/shared";
import * as Dialog from "@radix-ui/react-dialog";
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
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog__panel dialog__panel--save">
          <Dialog.Title className="dialog__title">Save snippet</Dialog.Title>
          <Dialog.Description className="dialog__description">
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
            <input
              className="dialog__input"
              type="text"
              autoFocus
              placeholder="Snippet name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="dialog__actions">
              <Dialog.Close asChild>
                <button type="button" className="dialog__button meta-label">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="dialog__button dialog__button--strong meta-label"
                disabled={trimmed === ""}
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
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
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog__panel dialog__panel--open">
          <Dialog.Title className="dialog__title">Open snippet</Dialog.Title>
          <Dialog.Description className="dialog__description">
            Saved in this browser.
          </Dialog.Description>

          {snippets.length === 0 ? (
            <p className="dialog__empty">Nothing saved yet.</p>
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
                    <span className="snippet-list__meta meta-label">
                      {LANGUAGE_LABEL[snippet.language]} ·{" "}
                      {getTargetDefinition(snippet.target).displayName}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="snippet-list__delete"
                    aria-label={`Delete ${snippet.name}`}
                    onClick={() => onDelete(snippet)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="dialog__actions">
            <Dialog.Close asChild>
              <button type="button" className="dialog__button meta-label">
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

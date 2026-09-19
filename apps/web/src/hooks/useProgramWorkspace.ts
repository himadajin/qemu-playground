import { useEffect, useState } from "react";
import { readShareStateFromHash } from "../lib/share";
import {
  loadFiles,
  persistFiles,
  reorderFiles,
  sameProgram,
  uniqueName,
  type FileCollection,
  type ProgramFile,
} from "../lib/files";

function initialize() {
  let collection: FileCollection;
  let error: string | null = null;
  try {
    collection = loadFiles(window.localStorage);
  } catch {
    collection = { files: [], selectedId: null, sidebarOpen: true };
    error =
      "Saved files could not be read. Reload to try again. Existing browser data has not been replaced.";
  }
  const shared = readShareStateFromHash(window.location.hash);
  const preview = shared
    ? {
        ...shared,
        id: crypto.randomUUID(),
        name: shared.language === "c" ? "shared.c" : "shared.s",
      }
    : null;
  return { collection, preview, previewSelected: !!preview, shared, error };
}

function clearHash() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function useProgramWorkspace() {
  const [state, setState] = useState(initialize);
  const { collection, preview, previewSelected, shared } = state;
  const [storageError, setStorageError] = useState(state.error);
  const active =
    previewSelected && preview
      ? preview
      : collection.files.find((file) => file.id === collection.selectedId);

  useEffect(() => {
    if (state.error) return;
    let error: string | null = null;
    try {
      persistFiles(window.localStorage, collection);
    } catch {
      error = "Changes could not be saved in this browser. Download your files to keep a copy.";
    }
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setStorageError(error);
    });
    return () => {
      disposed = true;
    };
  }, [collection, state.error]);

  function select(id: string) {
    setState((current) => ({
      ...current,
      previewSelected: id === current.preview?.id,
      collection:
        id === current.preview?.id ? current.collection : { ...current.collection, selectedId: id },
    }));
  }
  function add(file: ProgramFile) {
    setState((current) => ({
      ...current,
      previewSelected: false,
      collection: {
        ...current.collection,
        files: [...current.collection.files, file],
        selectedId: file.id,
      },
    }));
  }
  function updateActive(patch: Partial<Pick<ProgramFile, "code" | "target" | "compileOptions">>) {
    if (!active) return;
    const id = active.id;
    setState((current) =>
      current.preview?.id === id
        ? { ...current, preview: { ...current.preview, ...patch } }
        : {
            ...current,
            collection: {
              ...current.collection,
              files: current.collection.files.map((file) =>
                file.id === id ? { ...file, ...patch } : file,
              ),
            },
          },
    );
  }
  function renameFile(id: string, name: string) {
    setState((current) => ({
      ...current,
      collection: {
        ...current.collection,
        files: current.collection.files.map((file) => (file.id === id ? { ...file, name } : file)),
      },
    }));
  }
  function duplicateFile(id: string) {
    const copyId = crypto.randomUUID();
    setState((current) => {
      const file = current.collection.files.find((item) => item.id === id);
      if (!file) return current;
      const copy = {
        ...file,
        id: copyId,
        name: uniqueName(`${file.name.slice(0, -2)}-copy`, file.language, current.collection.files),
      };
      return {
        ...current,
        previewSelected: false,
        collection: {
          ...current.collection,
          files: [...current.collection.files, copy],
          selectedId: copy.id,
        },
      };
    });
  }
  function deleteFile(id: string) {
    setState((current) => {
      const index = current.collection.files.findIndex((file) => file.id === id);
      if (index < 0) return current;
      const files = current.collection.files.filter((file) => file.id !== id);
      return {
        ...current,
        collection: {
          ...current.collection,
          files,
          selectedId:
            current.collection.selectedId === id
              ? (files[Math.min(index, files.length - 1)]?.id ?? null)
              : current.collection.selectedId,
        },
      };
    });
  }
  function savePreview(name: string) {
    if (!preview) return;
    setState((current) => {
      if (!current.preview) return current;
      const file = { ...current.preview, name };
      return {
        ...current,
        preview: null,
        previewSelected: false,
        collection: {
          ...current.collection,
          files: [...current.collection.files, file],
          selectedId: file.id,
        },
      };
    });
    clearHash();
  }
  function closePreview() {
    setState((current) => ({ ...current, preview: null, previewSelected: false }));
    clearHash();
  }
  function reorder(ids: string[]) {
    setState((current) => ({
      ...current,
      collection: { ...current.collection, files: reorderFiles(current.collection.files, ids) },
    }));
  }
  function toggleSidebar() {
    setState((current) => ({
      ...current,
      collection: { ...current.collection, sidebarOpen: !current.collection.sidebarOpen },
    }));
  }
  return {
    collection,
    preview,
    previewSelected,
    active,
    storageError,
    previewEdited: !!preview && !!shared && !sameProgram(preview, shared),
    select,
    add,
    updateActive,
    renameFile,
    duplicateFile,
    deleteFile,
    savePreview,
    closePreview,
    reorder,
    toggleSidebar,
  };
}

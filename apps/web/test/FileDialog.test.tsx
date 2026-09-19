// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  FileDialog,
  type FileDraft,
  type FileDialogSubmission,
} from "../src/components/FileDialog";
import { createFile, type ProgramFile } from "../src/lib/files";

function setup(draft: FileDraft, files: ProgramFile[] = []) {
  const onSubmit = vi.fn<(submission: FileDialogSubmission) => void>();
  render(
    <MantineProvider>
      <FileDialog draft={draft} files={files} onClose={vi.fn()} onSubmit={onSubmit} />
    </MantineProvider>,
  );
  return { user: userEvent.setup(), onSubmit };
}

describe("file dialog input contracts", () => {
  it("returns the chosen program type and clears a collision when the extension changes", async () => {
    const file = createFile();
    const { user, onSubmit } = setup({ mode: "new", file }, [file]);
    await user.click(screen.getByRole("button", { name: "New file" }));
    expect(screen.getByText("A file with this name already exists.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Program type"), "aarch64");
    expect(screen.queryByText("A file with this name already exists.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New file" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      mode: "new",
      name: "hello.s",
      programType: "aarch64",
    });
  });

  it.each(["rename", "add"] as const)("returns only a name for %s", async (mode) => {
    const file = createFile("asm", "aarch64", "entry");
    const { user, onSubmit } = setup({ mode, file }, mode === "rename" ? [file] : []);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: mode === "rename" ? "Rename file" : "Add to files" }),
    );
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ mode, name: "entry.s" });
  });

  it("requires an explicit assembly target even when native form validation is bypassed", async () => {
    const { user, onSubmit } = setup({ mode: "import", file: createFile("asm") });
    const target = screen.getByLabelText("Assembly architecture", { exact: false });
    expect(target).toHaveValue("");
    const form = screen.getByLabelText("Filename").closest("form")!;
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Choose an architecture.")).toBeVisible();
    await user.selectOptions(target, "aarch64");
    expect(target).toHaveValue("aarch64");
    expect(screen.queryByText("Choose an architecture.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import source" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      mode: "import",
      name: "hello.s",
      target: "aarch64",
    });
  });

  it("returns no architecture change for a C import", async () => {
    const { user, onSubmit } = setup({ mode: "import", file: createFile("c") });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import source" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ mode: "import", name: "hello.c" });
  });
});

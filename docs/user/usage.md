# Using the playground

Create a C or assembly file, choose its target (RV64 or AArch64), edit the source, and select
**Run**. The Output tab shows program output and exit status; Build shows compiler
output. For C input, Assembly displays generated assembly for that Run's target.
You can select, copy, search, and scroll generated assembly, but cannot edit it.

## Editor keyboard controls

Use Cmd on macOS and Ctrl on other platforms for the shortcuts below.

- **Cmd/Ctrl+F** opens search. In the source editor, the search panel also offers replacement.
- **Cmd/Ctrl+Z** undoes an edit; **Cmd/Ctrl+Shift+Z** redoes it.
- **Cmd/Ctrl+/** toggles comments for the selected language and target.
- **Tab** indents and **Shift+Tab** unindents source code.
- To leave the editor with the keyboard, press **Escape**, release it, then press **Tab**.
  Use **Escape**, then **Shift+Tab** to move to the preceding control.

Code lines do not wrap. Scroll horizontally to inspect long lines.

## Files in this browser

The file sidebar holds independent programs. On wide screens, its icon buttons let you
show or hide the list, create a program, and import a source file. The expanded sidebar
starts at 240px and can be resized from 160px to 420px by dragging its divider. Its width
and open/closed preference are saved in this browser. Expanding the sidebar adds labels
beside the icons and shows the file list below the actions. When collapsed, hover over a
button or focus it with the keyboard to see its label. Hiding the list leaves these buttons
available and remembers your preference. Creating or importing a program keeps the list in
its current open or closed state. **New file** lets you choose a name and C,
Assembly (RV64), or Assembly (AArch64); each starts with runnable sample code.
Language and assembly architecture stay fixed. C files let you change the target
above the editor. Compiler options are always editable inline.

Code, settings, names, file order, and the last selected file are saved automatically
in this browser. No account is needed, and files do not sync to other devices.
Existing named snippets are migrated automatically. There is no manual Save button.

Select a file to switch programs. Undo/redo, selection, and scroll are preserved
while this page is open, but not across reloads. Each Run compiles only the selected
file; the files are not linked together.

Each file's menu offers **Rename**, **Duplicate**, **Download**, and **Delete**.
Deletion asks for confirmation and is unavailable while the file is running.
You can delete all files and start again from the empty workspace.

Drag a file's right-side handle to reorder the list. With a keyboard, focus its handle, press
**Space**, use **Up/Down**, and press **Space** to confirm or **Escape** to cancel.
On touch screens, choose **Reorder files** from a file menu to expose the handles,
then select **Done** when finished.

**Import files** creates a browser copy of a local `.c` or `.s` source file. Assembly
imports require an architecture choice. Edits do not change the original local
file. **Download** saves one file's code without its execution settings.

## Running and inspecting results

On wide screens, **Run** is in the results-sidebar header. This sidebar starts open at
400px and can be resized down to 320px. **Collapse results** hides it, including Run;
**Expand results** on the remaining icon rail restores it. Its width and open/closed state
are saved for all files in this browser. Closing it preserves results and the selected tab.

The two sidebar widths are independent: resizing one adjusts the editor while keeping the
other fixed. Each divider stops before the editor becomes narrower than 320px. You can
also focus a divider and use Left/Right arrows to move it by 16px, or Home/End to set that
sidebar's minimum/maximum width. If the window becomes too small, the sidebars temporarily
shrink; widening the window restores your preferred widths.

On narrow screens, **Run** stays
beside the **Code / Result** tabs and switches to Result when pressed. The file
sidebar becomes a drawer opened from the button to the left of these tabs. It overlays
the editor without shrinking it. Select a file, create or import a program, press Escape,
or click the background or **Close sidebar** to close it. Your desktop sidebar preferences
is preserved when returning to a wider window.

Only one program can run at a time. You can edit or switch files while it runs;
the result always belongs to the file that started it, and completion does not
switch you away from your current file.

Each file retains its last result during this page session. Editing its code or
settings marks that result **Out of date**. The last-run architecture and
**Run settings** identify what produced the output. Re-running keeps the previous
output visible with a notice until the new result arrives. A failed request shows
its error and retains previous output. Reloading clears all results.

Closing the Assembly result tab discards that viewer's state; opening it again
starts at the beginning.

## Sharing

**Share** creates a URL containing only the active program and its execution
settings. Opening a shared URL displays a **Shared preview** without changing your
saved files or automatically running code. You can edit and run it, switch to your
files and return, or select **Add to files** to keep the current preview.

Adding retains its undo history and results, even if a Run is still in progress.
Closing an edited preview asks before discarding it; a running preview cannot be
closed. Unsaved preview edits do not survive a reload.

Use the icon-only **Theme** button in the toolbar to choose **System**, **Light**, or
**Dark**. **System** follows your operating system's color preference; the choice is
remembered in this browser.

# Using the playground

Choose C or assembly and a target (RV64 or AArch64), edit the source, and select
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

## Keeping and replacing code

On narrow screens, switching between Code and Result keeps the source editor's
undo history, selection, and scroll position. Closing the Assembly result tab
discards that viewer's state; opening it again starts at the beginning.

**Open** loads a saved snippet and **Save** stores one in this browser. Opening a
snippet with different code resets the source editor's undo history, selection,
and scroll position. Language and target changes replace untouched samples, but
preserve edited source. When the code stays the same, changing language or target
also keeps the editor's state.

**Share** creates a URL containing the current code and settings. Opening that URL
restores the input without running it. Saved snippets and share URLs contain code
and run settings, not editor history or cursor position.

Use the icon-only **Theme** button in the toolbar to choose **System**, **Light**, or
**Dark**. **System** follows your operating system's color preference; the choice is
remembered in this browser.

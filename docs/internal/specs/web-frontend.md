# Web frontend behavior

A single-screen playground for entering code, running it, and inspecting results.

## Layout

- Above 1080px, independent file and results sidebars flank the source editor. The file
  sidebar starts at 240px expanded and can be resized from 160px to 420px, or collapsed
  to a 44px icon rail.
  Its width is stored under `qemu-playground:sidebar-width:v1`; invalid stored widths
  are clamped for display without being rewritten until the next resize. Collapse
  sidebar, New file, and Import files are stacked above the Files heading and full-width
  list. Only the list scrolls; actions stay at the top.
- The sidebar toggle shows only its icon in both states and exposes its action through
  hover/focus tooltips. New file and Import files add labels when expanded; the whole row
  remains clickable. Width changes take effect immediately; action labels transition over
  180ms unless reduced motion is enabled. Hidden sidebar content cannot receive focus.
  The open/closed preference is saved; creating or importing a program does not change it.
- The results sidebar starts open at 400px, with a minimum width of 320px. It can collapse
  to a 44px rail with an Expand results button. Its pixel width and open state are saved
  under `qemu-playground:results-width:v1` and `qemu-playground:results-open:v1`, independently
  of the selected file. Hidden results stay mounted, preserving Console folding and scroll position.
- The editor fills the remaining width, with a minimum of 320px. Resizing either sidebar
  keeps the opposite sidebar fixed and stops when the editor reaches its minimum. Shrinking
  the window temporarily reduces each sidebar's space above its minimum proportionally;
  widening it restores the preferred widths without rewriting them.
- Both dividers have a 12px hit area and visible keyboard focus. Left/Right arrows move
  the divider by 16px; Home/End set the associated sidebar to its minimum/maximum width.
  Dividers are available only for expanded sidebars. Expansion restores the preferred width,
  subject to available space. Double-clicking does not reset it. Dragging resizes content
  continuously and saves the width once on release; keyboard changes save immediately.
- At 1080px or below, a Show files button shares the Code / Console / Run bar. Files open
  in an initially closed overlay drawer without resizing the editor. The drawer is 280px
  wide, capped at the viewport width minus 32px, and uses the same actions-above-list layout.
  Close sidebar, Escape, backdrop clicks, file selection, new-file creation, and importing
  a selected source close it. Desktop open/closed preferences remain independent.
  File selection returns to Code. Running selects Console; completion never changes the selected file or tab.
- Source settings appear above the editor: filename, a C target selector or fixed assembly
  architecture, and an always-editable compiler-options input. On narrow screens, the options
  input occupies a second row. There is no separate settings screen.
- On wide screens, Run sits in the result header beside the current filename and target.
  Closing the results sidebar hides Run; reopening it makes execution available again.
  Execution completion never opens a closed sidebar. Share and Theme sit in the global header.

## Files and operations

- Each file is an independent complete program. Run submits only its source and settings.
  There are no folders, multi-file compilation, linking, search, or sorting controls.
- New opens a dialog with a suggested unique name and C / Assembly (RV64) / Assembly (AArch64)
  choices, derived from the shared target table. Creation starts with a runnable sample; C
  defaults to RV64. Language and assembly architecture are fixed for the lifetime of a file.
- C target and compiler options are editable inline and remembered per file. Changing the C
  target does not replace source code.
- Names are unique, with `.c` for C and `.s` for assembly. Renaming preserves language and target.
  Assembly architecture appears separately in the list.
- New file and Import files appear at the top of the sidebar or mobile drawer. Each file's menu provides Rename, Duplicate,
  Download, Reorder files, and Delete. Duplicate opens the copy with a unique name such as
  `hello-copy.c`, preserving its source and execution settings.
- Delete asks for confirmation naming the file. A running file cannot be deleted. Deleting
  the last file is allowed and displays an empty workspace with creation and import actions.
- Files start in creation order. Drag a row's right-side handle to reorder. Filenames start
  at the left without a handle gutter and do not shift when controls appear. Handles and menus appear on
  hover or keyboard focus on pointer devices; touch devices show menus, with handles exposed
  through Reorder files mode. There are no Move up / Move down buttons.
- Keyboard reordering: focus a handle, press Space or Enter, use Up/Down, then Space or Enter
  to confirm or Escape to cancel. Position changes are announced. Leaving the handle commits
  the current order.
- Import reads one local `.c` or `.s` file into a browser-managed copy. Assembly import requires
  an explicit architecture choice. Edits never write back to the original local file.
- Download works from any file's menu without selecting it. It contains source code only,
  with no settings or metadata. There is no whole-collection export/import format.

## Execution and results

- Only one Run may be in flight across the playground. An immediate guard prevents duplicate
  submissions before React updates the disabled button. Editing and file switching remain available.
- While another file runs, Run is disabled and the executing filename is shown. Late responses
  update only the originating file, including when a shared preview is added to files mid-run.
- Each file keeps up to 20 session-only run records, oldest first. Submission appends an expanded
  record; completion updates that exact file and run. Results and request failures never overwrite
  earlier records. The twenty-first submission evicts only that file's oldest record.
- Records capture immutable source, language, target, compiler options, filename, and start time.
  Numbers increase per file through eviction and Clear; reload resets them. Deleting a file or
  closing a preview releases its history and Console position. Saving a preview preserves its ID.
- Each header is a keyboard-operable folding control showing number, local start time, target,
  and status, including exit code, signal, or timeout phase. Non-today timestamps include the date;
  Details and copied logs include the complete date, time, and timezone.
- New runs never automatically fold existing records. Fold states survive file switches. Expanded
  records expose Details, Copy log, and View assembly when code is present; actions do not rely on hover.
- Only the latest record shows `Inputs changed since this run` when source, language, target, or
  compiler options differ. Renaming alone does not mark a record stale.
- Nonempty build diagnostics, stdout, stderr, and the final outcome appear in that order, separated
  by labels within a run, with thin rules between runs. Empty streams are omitted. Logs preserve
  whitespace and newlines, wrap long lines, and mark per-section truncation. stdout/stderr remain
  separate groups; delivery is completion-based and does not reconstruct interleaving.
- Console follows additions/completions only while at the bottom (within 24px). Otherwise the
  visible run and relative position are preserved where geometry permits. Folding anchors the
  operated header. Evicting the visible run moves to the first remaining run. Jump to latest moves
  to the latest run's end, or its folded header, without changing fold state. Console position
  survives file switches, hidden tabs/sidebar, and closing viewers.
- The toolbar discloses the 20-run per-file limit and reload clearing. Empty Console says
  `Run this file to see output here.` Clear is disabled when empty or while any request is running.
  Its confirmation names the file and record count, explains other files are unaffected, and
  initially focuses Cancel. Clearing preserves the next sequence number.
- Copy log is enabled on completed or failed records. It copies number, full start time, target,
  labeled nonempty diagnostics/stdout/stderr, truncation notices, and outcome, but never source or
  generated assembly. Copy success/failure is announced beside the control.
- Details shows captured settings above a read-only source editor. Generated assembly opens in a
  separate wide modal only for C input with nonempty assembly code. `available: true` with empty
  code means extraction failed: explain this beside the run's compiler diagnostics independently
  of its execution outcome. Neither viewer follows later edits or target changes.
- Viewers are full-screen at 1080px or below and expose Copy and Find. Reopening resets selection,
  search, and scroll. Console position is preserved on close. An open viewer retains its captured
  run even if retention subsequently removes the record.
- Theme offers System, Light, and Dark, persisted under `qemu-playground:color-scheme:v1`.

## Status badges

- `exit 0` (green) represents normal exit code zero. `nonzero exit` (red) represents other normal
  exits, with the exact exit code visible. API `success` does not imply program success.
- `compile error` and `runtime error` (red) distinguish build failure from signal termination;
  the signal is visible. `timeout` (orange) is accompanied by its compile/run phase.
- `running` (blue) indicates an in-flight request without claiming compilation/execution progress.
- `request failed` (red) covers capacity limits, server errors, and network failures. The reason
  belongs to its own record and cannot inherit an earlier run's success badge.

## Loading and editors

- The toolbar and workspace render before the complete CodeMirror 6 editor component loads through
  React.lazy. Suspense displays Mantine Skeleton placeholders in a fixed-size editor shell, avoiding
  layout shifts. The core, extensions, and all language modes share one lazy editor chunk.
- Editors follow the active application color scheme using Mantine tokens, Geist Mono, and 13px code
  text. The default `System` choice follows `prefers-color-scheme` and updates while the page is open;
  `Light` and `Dark` override it. Editable source, captured source, and generated assembly have line numbers. Long lines do
  not wrap; each editor fills its container and scrolls horizontally and vertically. Focus, selection,
  and search matches are visible.
- Editing supports undo/redo, search/replace, bracket matching and automatic closing, indentation,
  language-aware comment toggling, and syntax highlighting. Tab indents and Shift+Tab unindents;
  Escape followed by Tab moves focus out of the editor. There is no completion, diagnostics,
  formatting, folding, or language service.
- C uses the C/C++ language package. Assembly uses the legacy GNU assembler modes: gas for RV64 and
  future targets without a dedicated mode, and gasArm for AArch64. Line comments are recognized and
  toggled with # on RV64 and // on AArch64; AArch64 # immediates remain code. Highlighting is basic,
  without complete instruction or register coverage for either architecture.
- React controls the document. Source editor state is cached by file identity for the page
  session: switching files or responsive layouts restores undo/redo, selection, and scroll,
  including when two files have identical source. Theme and target changes reconfigure the
  restored state. Deleted and closed-preview caches are released.
- A different external value for the same editor identity resets its editing history and
  selection. Results and editor history are never persisted in browser storage.
- Generated assembly is read-only but remains focusable, selectable, copyable, searchable, and
  scrollable. Its language mode uses the target captured when the Run was submitted, even if the
  selected target later changes. Source editing remains available while a Run is in progress.
- An editor-scoped error boundary displays an accessible reload message on loading failure; the
  surrounding toolbar and results remain available.

## Visual design

- Mantine provides standard component colors, radii, shadows, focus states, and interaction feedback.
  The theme control is icon-only so it preserves the compact toolbar while remaining discoverable by
  tooltip and accessible name. The application starts in `System` mode and supports explicit light and
  dark overrides.
- The centralized theme retains Geist for UI text, Noto Sans JP as its Japanese fallback, and
  Geist Mono for code and logs. Controls use compact standard sizes; code and logs use 13px text.
- Mantine NativeSelect, TextInput, Button, Menu, Drawer, Tabs, Modal, Alert, Badge, Skeleton,
  and Splitter provide the common controls. Custom CSS handles playground layout, divider appearance, scrolling, log formatting,
  and editor positioning.
- Editor search panels stay inside their editor containers. Dropdowns and modal portals render
  above the workspace; no editor-specific elevated stacking layer is used.

## Dialogs and keyboard access

- Controls have accessible names. Tabs activate with arrow keys. Dialogs trap focus, support
  Escape, and return focus to their opener.
- New, Import, Rename, and Add to files dialogs focus the filename. Empty names and duplicate
  normalized names cannot be submitted. The extension is fixed by the language.
- Share shows a checkmark and Copied for two seconds after success without changing button size.
  Errors remain in a popover until dismissed or replaced. Dismissal returns focus to Share.

## API requests

- The frontend calls only the same-origin `POST /api/run`. Vite proxies development requests to
  `http://localhost:8080`.
- Request construction and response interpretation use the shared Zod schemas.
- HTTP 200 statuses are results; HTTP 400/429/500 and transport failures produce a `request failed` badge
  and explanatory Console outcome.

## Share URLs

- Format: `<origin>/#s=<payload>`. The payload is `JSON.stringify({v, l, t, c, o})`, compressed with
  lz-string's `compressToEncodedURIComponent`. These fields represent format version, language,
  target, code, and compiler options. The format version is 1.
- The fragment is not sent to the server. Opening a valid URL creates an editable, runnable
  temporary preview without overwriting or adding to the saved collection. Invalid payloads
  are ignored. Opening a link never runs code automatically.
- The preview remains available when switching to a saved file. Its unsaved status is explicit.
  Closing an edited preview asks for confirmation; an unchanged preview closes immediately.
  A running preview cannot close. Reload discards preview edits and reopens the URL payload.
- Add to files asks for a unique filename and transfers the current preview into the collection,
  retaining its editor identity, undo history, results, and any in-flight run. The preview entry
  disappears and the URL fragment is cleared. Closing also clears the fragment.
- Share includes only the active program and execution settings, never the collection.
- The full URL limit is 2000 characters. Exceeding it displays an error without truncating the data
  or changing the address bar.
- Share updates the address bar and copies the URL to the clipboard. If copying fails, feedback
  directs the user to the URL in the address bar.

## Browser persistence

- `qemu-playground:files:v1` stores files in user order, the last selected saved-file ID, and the
  desktop sidebar preference. A file contains ID, name, language, target, code, and compiler options.
  Changes persist automatically; there are no manual Open or Save actions and no account sync.
- A first visit without files creates one RV64 C sample. A persisted empty collection stays empty.
- When the collection key is absent, valid entries from `qemu-playground:snippets:v1` migrate with
  their source and settings. Names gain the correct extension, path/control characters are
  normalized, and numeric suffixes resolve collisions without dropping programs. Migration keeps
  the previous newest-save-first order because legacy data has no creation timestamp. The old
  storage key remains intact; subsequent loads use the collection key.
- An unreadable collection is not silently overwritten. Storage errors are shown in an alert;
  a write failure keeps the current in-memory edits available for individual download.

## Samples

- There are four samples: C / assembly combined with RV64 / AArch64.
- Assembly samples use `_start` and direct write/exit syscalls, writing one line and exiting with 42.
- Samples populate newly created files. File switching and target changes never substitute samples
  for existing code.

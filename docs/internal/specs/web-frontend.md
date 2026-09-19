# Web frontend behavior

A single-screen playground for entering code, running it, and inspecting results.

## Layout

- Above 1080px, a 44px action rail sits beside resizable source and result panes. It contains
  icon buttons for toggling the file list, New, and Import. Expanding the list makes the sidebar
  240px wide in total. Toggling is immediate and leaves the action buttons in place; the
  open/closed preference is saved in the file collection. Creating or importing a program
  selects it without changing this preference.
- Desktop action labels appear in tooltips on hover or keyboard focus, not as persistent text.
  The expanded list has a Files heading without a count.
- Source and result panes start at 50:50, with a minimum width of 320px each. Drag the central
  divider, or focus it and use Left/Right arrows to adjust by 16px. The divider has a 12px hit
  area and a visible focus indicator. Neither pane can collapse.
- The preferred split ratio is stored under `qemu-playground:workspace-ratio:v1`. Viewport
  changes constrain the displayed ratio without replacing the preference.
- At 1080px or below, files appear in an initially closed overlay drawer. Selecting a file
  closes it. Code / Result tabs share an always-visible bar with Run. Running selects Result;
  completion never changes the selected file or tab.
- Source settings appear above the editor: filename, a C target selector or fixed assembly
  architecture, and an always-editable compiler-options input. On narrow screens, the options
  input occupies a second row. There is no separate settings screen.
- On wide screens, Run sits in the result header beside the current filename and target.
  Share and Theme sit in the global header.

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
- New and Import appear in the desktop action rail or at the top of the mobile drawer. Each file's menu provides Rename, Duplicate,
  Download, Reorder files, and Delete. Duplicate opens the copy with a unique name such as
  `hello-copy.c`, preserving its source and execution settings.
- Delete asks for confirmation naming the file. A running file cannot be deleted. Deleting
  the last file is allowed and displays an empty workspace with creation and import actions.
- Files start in creation order. Drag a row's handle to reorder. Handles and menus appear on
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
- Each file keeps its last result and selected result tab during the page session. Results
  are not restored after a reload. Run selects Output.
- Editing retains the last result. `Out of date` appears when source, target, or compiler options
  differ from the submitted input, and disappears when they match again. The last-run target
  is visible; a disclosure shows its compiler options.
- Re-running retains the previous output and labels it as such while running. A completed run,
  including compilation failure, replaces it. A failed request retains previous output and
  displays the failure reason.
- Output displays stdout, stderr, exit code or signal, execution state, and failure details.
  Build displays compiler output. Truncation is explicitly marked.
- Assembly displays generated C assembly in a read-only editor using the submitted target.
  It is disabled for assembly input. Inactive result panels unmount, so the generated assembly
  viewer does not retain its cursor or scroll when its tab closes.
- Theme offers System, Light, and Dark, persisted under `qemu-playground:color-scheme:v1`.

## Status badges

The labels are `success`, `compile error`, `runtime error`, `timeout`, `running`, and `error`.

- The first four correspond to HTTP 200 result statuses in the
  [run protocol](../contracts/run-protocol.md). A normal exit with a nonzero code remains `success`;
  the exit code is displayed separately.
- `running` indicates an in-flight Run.
- `error` covers an unsuccessful request, including capacity limits, server errors, and network
  failures. Its reason appears in Output.
- Colors supplement the labels: green for success, blue for running, orange for timeout, and red
  for compile, runtime, and request errors.

## Loading and editors

- The toolbar and workspace render before the complete CodeMirror 6 editor component loads through
  React.lazy. Suspense displays Mantine Skeleton placeholders in a fixed-size editor shell, avoiding
  layout shifts. The core, extensions, and all language modes share one lazy editor chunk.
- Editors follow the active application color scheme using Mantine tokens, Geist Mono, and 13px code
  text. The default `System` choice follows `prefers-color-scheme` and updates while the page is open;
  `Light` and `Dark` override it. Both source and generated assembly have line numbers. Long lines do
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
- HTTP 200 statuses are results; HTTP 400/429/500 and transport failures produce an `error` badge
  and explanatory Output log.

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

# Web frontend behavior

A single-screen playground for entering code, running it, and inspecting results.

## Layout

- Above 900px, a compact toolbar sits above two resizable panes: source code on the left
  and results on the right. The workspace fills the available viewport height; panes scroll
  independently rather than extending the entire page.
- Desktop panes start at 50:50, with a minimum width of 320px each. Drag the central divider
  using a mouse or touch, or focus it with Tab and use Left/Right arrows to adjust by 16px.
  The divider is a thin line without a grip, with a 12px interaction area and a visible keyboard
  focus indicator. Neither pane can collapse.
- The preferred split ratio is stored in LocalStorage under `qemu-playground:workspace-ratio:v1`.
  Reloading restores it; viewport changes constrain the displayed split to the minimum widths
  without replacing the preference. Invalid or unavailable storage falls back to equal widths.
  There is no reset-to-equal-width action.
- At 900px or below, the workspace uses `Code / Result` tabs with the toolbar always visible.
  Switching these tabs preserves the source editor instance, including editing state and undo history.
- Mobile supports reading code and results, running code, and inspecting restored share URLs.
  It does not provide a separate mobile editing interface.
- There is no permanent sidebar, file tree, or settings panel. Saved snippets are managed through
  `Open` and `Save` dialogs.

## Toolbar

- The controls are language, target, compile options, `Run`, `Open`, `Save`, `Share`, and an
  icon-only Theme menu.
- Language uses a segmented control; target uses a non-clearable select.
- `Run` is the primary action. `Share` encodes the current code, language, target, and compiler options.
- Theme uses a Mantine `ActionIcon` with an accessible name and tooltip. Its menu offers `System`,
  `Light`, and `Dark`; the selected choice is persisted in LocalStorage under
  `qemu-playground:color-scheme:v1`.
- Compile options are always visible and optional. The placeholder gives an example (`-O2`);
  there is no additional tooltip or explanatory text.
- During execution, Run displays a loading indicator and is disabled. An in-flight guard also
  prevents duplicate submissions before the disabled state renders.

## Results

- Result tabs are `Output / Build / Assembly`. Run selects `Output` and, on narrow screens, `Result`.
- Each Run replaces the previous result with the current running state.
- `Output` displays stdout, stderr, exit code or signal, execution state, and failure details.
  `Build` displays compiler output. Truncated output is explicitly marked.
- `Assembly` displays generated C assembly in a read-only editor. It is disabled for assembly input.
  Changing to assembly input while that tab is selected displays `Output` instead.
- Inactive result panels unmount. The generated assembly editor initializes only when its tab is
  displayed and assembly is available; its cursor and scroll position are not retained on tab changes.
- Error details remain in the logs, with a short status badge in the result header. Status changes
  are announced through a polite live region.

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
- React controls the document. Editor edits update React; receiving the same text does not reset
  editor state or notify React again. A different external value starts a replacement document with
  empty undo history, collapsed selection at the start, and scroll at the top left. Language, target,
  and read-only changes preserve the view and editing state unless the document also changes.
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
- Mantine SegmentedControl, Select, TextInput, Button, NavLink, Tabs, Modal, Alert, Badge, Skeleton,
  and Splitter provide the common controls. Custom CSS handles playground layout, divider appearance, scrolling, log formatting,
  and editor positioning.
- Editor search panels stay inside their editor containers. Dropdowns and modal portals render
  above the workspace; no editor-specific elevated stacking layer is used.

## Dialogs and keyboard access

- Controls have accessible names and support keyboard navigation. Tabs activate with arrow keys.
- Dialogs trap focus, close with Escape or an outside click, and return focus to their opener.
- Save initially focuses the snippet name. Whitespace-only names cannot be saved; names are trimmed.
  Saving an existing name replaces that snippet without a separate confirmation.
- Open initially focuses the first saved snippet, or Close when the list is empty. A snippet can be
  opened or deleted with its own named control. The empty state reads `Nothing saved yet.`

- Share and Save show a checkmark and `Copied` or `Saved` inside the respective button for two
  seconds after success. Button dimensions and header height stay unchanged during feedback.
- Share errors appear in a popover below the button without resizing the workspace. They remain
  until dismissed with the close control or Escape, or replaced by a subsequent Share result.
  Dismissing returns focus to Share. Success and error feedback are announced to screen readers.

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
- The fragment is not sent to the server. Opening a URL restores the form without running it.
  Invalid payloads are ignored in favor of the normal initial state.
- The full URL limit is 2000 characters. Exceeding it displays an error without truncating the data
  or changing the address bar.
- Share updates the address bar and copies the URL to the clipboard. If copying fails, feedback
  directs the user to the URL in the address bar.

## Local snippets

- Snippets live only in LocalStorage under `qemu-playground:snippets:v1`.
- Each stores a name, language, target, code, and compiler options, plus its ID and save time.
- Saving under an existing name retains its ID and updates its contents. Open lists the newest
  snippets first and supports loading and deletion. Corrupt entries are skipped.

## Samples

- There are four samples: C / assembly combined with RV64 / AArch64. The default is RV64 C hello world.
- Assembly samples use `_start` and direct write/exit syscalls, writing one line and exiting with 42.
- Language or target changes replace the code only if it exactly matches one of the bundled samples.
  User edits are preserved.

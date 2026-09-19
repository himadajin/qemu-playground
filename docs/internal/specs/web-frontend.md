# Web frontend behavior

A single-screen playground for entering code, running it, and inspecting results.

## Layout

- Above 900px, a compact toolbar sits above two equal-width panes: source code on the left
  and results on the right. The workspace fills the available viewport height; panes scroll
  independently rather than extending the entire page.
- At 900px or below, the workspace uses `Code / Result` tabs with the toolbar always visible.
  Switching these tabs preserves the source editor instance, including editing state and undo history.
- Mobile supports reading code and results, running code, and inspecting restored share URLs.
  It does not provide a separate mobile editing interface.
- There is no permanent sidebar, file tree, or settings panel. Saved snippets are managed through
  `Open` and `Save` dialogs.

## Toolbar

- The controls are language, target, compile options, `Run`, `Open`, `Save`, and `Share`.
- Language uses a segmented control; target uses a non-clearable select.
- `Run` is the primary action. `Share` encodes the current code, language, target, and compiler options.
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

- The toolbar and workspace render before Monaco loads. A fixed-size editor shell with Mantine
  Skeleton placeholders reserves the editor's space and avoids layout shifts.
- Monaco is loaded lazily and uses its built-in `vs` theme, Geist Mono, and 13px code text.
- Generated assembly is read-only. Source editing remains available while a Run is in progress.
- An editor loading failure displays an accessible message asking the user to reload.

## Visual design

- Mantine provides standard component colors, radii, shadows, focus states, and interaction feedback.
  Light mode is fixed; there is no dark-mode control.
- The centralized theme retains Geist for UI text, Noto Sans JP as its Japanese fallback, and
  Geist Mono for code and logs. Controls use compact standard sizes; code and logs use 13px text.
- Mantine SegmentedControl, Select, TextInput, Button, Tabs, Modal, Badge, and Skeleton provide the
  common controls. Custom CSS handles playground layout, pane sizing, scrolling, log formatting,
  and editor positioning.
- Monaco widgets are contained in the app's stacking context so that dropdowns and modal portals
  render above them.

## Dialogs and keyboard access

- Controls have accessible names and support keyboard navigation. Tabs activate with arrow keys.
- Dialogs trap focus, close with Escape or an outside click, and return focus to their opener.
- Save initially focuses the snippet name. Whitespace-only names cannot be saved; names are trimmed.
  Saving an existing name replaces that snippet without a separate confirmation.
- Open initially focuses the first saved snippet, or Close when the list is empty. A snippet can be
  opened or deleted with its own named control. The empty state reads `Nothing saved yet.`

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

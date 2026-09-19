# @qemu-playground/web

React/Vite frontend for independent C and assembly programs, QEMU execution, and
result inspection. The behavior specification is
[web-frontend.md](../../docs/internal/specs/web-frontend.md).

## Development

```sh
npm run dev --workspace @qemu-playground/web
npm run build --workspace @qemu-playground/web
npm run typecheck --workspace @qemu-playground/web
npm run test --workspace @qemu-playground/web
```

The frontend calls same-origin `POST /api/run`. Vite proxies `/api` to
`http://localhost:8080` during development.

## Deployment

Cloudflare Workers serves `dist/` as static assets. `worker/index.ts` forwards
`/api/*` to the Cloudflare Tunnel origin without rewriting paths. When configured,
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` authenticate the proxy with
Cloudflare Access. `wrangler.jsonc` defines the custom domain and `API_ORIGIN`;
workers.dev and preview URLs are disabled to prevent bypassing Access.

Pushes to `main` deploy through `.github/workflows/deploy-web.yml`. For local Worker
checks, manual deployment, and infrastructure setup, see
[self-hosting](../../docs/user/self-hosting.md).

## Files and persistence

The sidebar manages independent, single-source programs. Above 1080px, a persistent
sidebar uses 44px for icons or starts at 240px when expanded. Drag its divider to choose
any width from 160px to 420px; resizing is immediate, labels respect reduced-motion
preferences, and the width is saved under `qemu-playground:sidebar-width:v1`. Collapsed labels
appear in hover/focus tooltips. At 1080px or below, a button beside Code / Result / Run
opens a fixed 280px overlay drawer with the same vertical layout. Files have unique names,
fixed language and assembly architecture, and per-file compiler options and C target.
Creation, rename, duplication, deletion, source import/download, and accessible manual
reordering are supported. There are no folders or multi-file builds.

The desktop results sidebar starts open at 400px, has a 320px minimum, and collapses to a
44px rail. Run remains inside it and is unavailable while it is closed. `SidebarLayout`
uses one Mantine splitter hook for both independent pixel widths and the flexible editor.
Dragging changes only the adjacent sidebar and editor, preserving at least 320px for the
editor; width persistence occurs on release. Keyboard resizing saves immediately. A smaller
viewport temporarily constrains both sidebar widths without replacing their preferences.

`lib/files.ts` manages the collection stored automatically under
`qemu-playground:files:v1`: file records, manual order, last selected saved file,
and desktop sidebar open/closed preference. The independent sidebar width preference
uses `qemu-playground:sidebar-width:v1`. Results width and open state use
`qemu-playground:results-width:v1` and `qemu-playground:results-open:v1`, shared across files.
Files contain ID, name, language, target,
code, and compiler options. An explicitly empty collection remains empty on reload.

When the new key is absent, `lib/storage.ts` reads legacy
`qemu-playground:snippets:v1` entries for migration. Normalization and unique suffixes
preserve all valid programs despite filename collisions. The old key stays intact.
Unreadable collection data is not overwritten. No account or server storage is used.

Results and editor history are session-only. Each run captures its source file ID
and input snapshot. Only one request is allowed at a time; switching files cannot
redirect late results. Editing marks differing results as out of date. Re-running
retains previous output while waiting; request failures retain it with an error.

## Sharing

Version-1 share links encode `JSON.stringify({v, l, t, c, o})` using lz-string's
`compressToEncodedURIComponent` in `#s=<payload>`. The fragment is not sent to the
server. Decode it directly, not through URLSearchParams, because it can contain `+`.
The full URL limit is 2000 characters; oversized shares report an error without
truncation or changing the URL. Share updates the address bar and copies the link.

A shared link opens an editable, runnable temporary preview, separate from saved
files. Add to files preserves its identity and session state, including in-flight
execution. Closing an edited preview asks for confirmation. Adding or closing clears
the fragment; reload otherwise reopens the original URL payload. Only the active
program and settings are shared, never the collection.

## Editor

The complete CodeMirror 6 editor component is loaded with `React.lazy`.
`Suspense` displays Mantine Skeleton placeholders inside a fixed-size shell while
it loads, so the toolbar and workspace render immediately without layout shifts.
An editor-scoped error boundary shows an accessible reload message if loading fails.

`CodeEditor` integrates `EditorView` directly. The editor core, extensions, C mode
(`@codemirror/lang-cpp`), and assembly modes are bundled into one lazy chunk.
Assembly uses the legacy GNU assembler modes: `gas` for RV64 and as the fallback
for other targets, and `gasArm` for AArch64. A small adaptation recognizes AArch64
`//` comments while preserving `#` immediates; comment toggling uses `#` on RV64
and `//` on AArch64. The modes provide basic highlighting, not complete
architecture-specific instruction or register coverage.

The configuration starts with `minimalSetup` and adds line numbers, search and
replace, bracket matching and closing, and indentation. No completion, diagnostics,
folding, formatting, or language service is enabled. The editor follows the application
color scheme, uses Geist Mono, keeps lines unwrapped, and scrolls independently.

The React value controls the document. A session cache keyed by file ID preserves
CodeMirror state, undo/redo, selection, and scroll across file switches and responsive
layout changes. Cached states reconfigure their theme, language, and change listener
when restored. Deleted files and closed previews release their cache entries.
A different external value for the same editor identity resets editing state.
Generated assembly uses the target captured when its Run was submitted and is
read-only, focusable, selectable, copyable, and searchable. Closing its result tab
unmounts the view and discards its editing state.

See [Using the playground](../../docs/user/usage.md) for keyboard controls,
including **Escape, then Tab** to leave the editor.

# AGENTS.md

Web playground: write C or assembly in the browser, pick a target architecture (RV64 / AArch64
first), and run it with QEMU user-mode emulation — showing stdout, stderr, exit code, and
optionally the generated assembly.

## Repository

npm workspaces monorepo (Node version: see `.nvmrc`):

- `apps/web` — React + Vite frontend, plus the Cloudflare Worker that proxies `/api/*`
- `apps/api` — Fastify server; spawns a short-lived runner container per run via the Docker socket
- `packages/shared` — Zod protocol schemas and target table, consumed as raw TS (no build step)
- `runner/` — Dockerfile for the execution image (`qemu-playground-runner:dev`)

There are no root `dev`/`build` scripts; use `npm run <script> --workspace @qemu-playground/<name>`.

## Development

Local dev loop:

```sh
docker build -t qemu-playground-runner:dev runner/   # required: api cannot run without this image
npm run dev --workspace @qemu-playground/api         # listens on :8080
npm run dev --workspace @qemu-playground/web         # Vite proxies /api to :8080
```

Run all checks before committing (CI runs the same set):

```sh
npm run lint          # auto-fix: npm run lint:fix
npm run format:check  # auto-fix: npm run format
npm run typecheck
npm run test          # API_SKIP_INTEGRATION_TESTS=1 skips the Docker-based API tests
```

To check the Worker without Cloudflare auth: `npx --prefix apps/web wrangler dev`.
The frontend auto-deploys from `main`; api/runner are deployed manually
(see `docs/user/self-hosting.md`).

## Docs and sources of truth

- Machine-readable definitions win over prose: `packages/shared/src/protocol.ts` (run protocol)
  and `packages/shared/src/targets.ts` (target table) are authoritative.
- `docs/` describes current behavior only — no history, no plans. Plans live in GitHub Issues;
  history lives in git.
  - `docs/user/` — installation, configuration, usage
  - `docs/internal/specs/` — confirmed behavior specs
  - `docs/internal/contracts/` — component boundaries (web ↔ API run protocol)
- When a change alters documented behavior, update the affected doc in the same PR.
- If docs and code disagree, do not assume either side is correct — report the mismatch and
  confirm which one to fix.
- API runtime env vars are documented in `apps/api/README.md`; per-package READMEs cover details.

## Security invariants — do not weaken

The service executes untrusted code. Preserve these:

- The `compileOptions` allowlist in `apps/api/src/compile-options.ts` — never pass through
  arbitrary compiler flags.
- Request strings are never interpolated into shell commands; argv reaches
  `apps/api/src/runner/run.sh` as NUL-separated files.
- Runner container hardening: `--network none`, CapDrop ALL, no-new-privileges, non-root uid.

## Conventions

- Write everything in English: code comments, docs, commit messages.
- Commits: Conventional Commits, concise (e.g. `feat(runner): support arm64 hosts`).

# @qemu-playground/web

React/Vite フロントエンド。コード入力、Run、結果表示が 1 画面で完結する playground。
画面仕様は `docs/internal/specs/web-frontend.md` を正とする。

## 起動

```sh
npm run dev --workspace @qemu-playground/web        # 開発サーバー
npm run build --workspace @qemu-playground/web      # 型チェック + 本番ビルド (dist/)
npm run typecheck --workspace @qemu-playground/web
npm run test --workspace @qemu-playground/web
```

API は常に同一オリジンの相対パス `POST /api/run` を呼ぶ。
開発時は Vite の proxy が `/api` を `http://localhost:8080` へ中継する
(`vite.config.ts`)。本番でこの経路を担うのは Cloudflare 側の設定であり、
フロントエンドのコードは変わらない。

## デプロイ(Cloudflare Workers)

`dist/` を Workers の static assets として配信し、`/api/*` だけ
`worker/index.ts` の Worker fetch handler が Cloudflare Tunnel オリジンへ
素通しする(`wrangler.jsonc` の `assets.run_worker_first`)。パス書き換えは
行わない。Tunnel ホスト名は Cloudflare Access の Service Token ポリシーで
保護されているため、Worker secrets `CF_ACCESS_CLIENT_ID` /
`CF_ACCESS_CLIENT_SECRET` が設定されていれば対応するヘッダを付与する。

配信ホスト名(カスタムドメイン)とプロキシ先オリジンは `wrangler.jsonc` の
`routes` と `vars.API_ORIGIN` で設定する。Access を迂回できないよう
workers.dev / preview URL は無効化している。`main` への push で
`.github/workflows/deploy-web.yml` が自動デプロイする。手動デプロイ・
ローカル確認・Cloudflare 側の前提作業は
[docs/user/self-hosting.md](../../docs/user/self-hosting.md) を参照。

```sh
npx --prefix apps/web wrangler dev      # ローカル確認(認証不要)
npx --prefix apps/web wrangler deploy   # 要 Cloudflare 認証
```

## 共有 URL

コード・言語・ターゲット・コンパイルオプションを URL フラグメント
`#s=<payload>` に埋め込む。フラグメントのためサーバーには送信されない。

- エンコード: `JSON.stringify` した状態を lz-string の
  `compressToEncodedURIComponent` で圧縮する。可逆で、出力はフラグメントに
  そのまま置ける文字だけを含む。
  ペイロードに `+` が含まれるため復元は `URLSearchParams` を使わず手動で切り出す。
- 上限: URL 全体で **2000 文字** (`MAX_SHARE_URL_LENGTH`)。
  超える場合は URL を作らず、切り詰めもせずエラーとして通知する。
- URL を開くとフォームが復元されるだけで、自動実行はしない。
- Share 実行時はアドレスバーを共有 URL に置き換え、クリップボードへコピーする。

## 保存

LocalStorage のキー `qemu-playground:snippets:v1` に配列として保存する。
サーバーには一切保存しない。

- 保存対象: スニペット名、言語、ターゲット、コード、コンパイルオプション、保存時刻。
- `Save` は名前を付けて保存する。同名のスニペットがある場合は id を保ったまま上書きする。
- `Open` は保存済み一覧をダイアログで表示し、選択して読み込む/削除する。
  常設のサイドバーやファイルツリーは持たない。
- 壊れたエントリは読み飛ばし、一覧全体を失わない。

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
folding, formatting, or language service is enabled. The light theme uses Geist
Mono, non-wrapping lines, and independent editor scrolling.

The React value controls the document. Editor edits notify `onChange`; matching
values preserve editing state. A different external value resets undo history,
selection, cursor, and scroll. Language, target, and read-only changes reconfigure
the existing view. Narrow-layout Code/Result tabs keep the source editor mounted.
Generated assembly uses the target captured when its Run was submitted and is
read-only, focusable, selectable, copyable, and searchable. Closing its result tab
unmounts the view and discards its editing state.

See [Using the playground](../../docs/user/usage.md) for keyboard controls,
including **Escape, then Tab** to leave the editor.

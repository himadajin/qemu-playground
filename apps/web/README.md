# @qemu-playground/web

React/Vite フロントエンド。コード入力、Run、結果表示が 1 画面で完結する playground。
画面仕様は `docs/internal/plans/001-prototype/ui.md` を正とする。

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
素通しする(`wrangler.jsonc` の `assets.run_worker_first`)。パス書き換えや
ヘッダ変更は行わない。

デプロイ先オリジンは `wrangler.jsonc` の `vars.API_ORIGIN` で設定する
(プレースホルダ値なので実値に置き換える)。`main` への push で
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

## エディタ

Monaco Editor は動的 import で遅延ロードする。
ツールバーと画面骨格を先に描画し、エディタ領域は固定サイズの shell と
skeleton で埋めてレイアウトシフトを避ける。

バンドルにはエディタ本体と必要な contribution、C の文法だけを含める
(`src/editor/monacoSetup.ts`)。パッケージ既定のエントリは全言語と
TypeScript 言語サービスを巻き込むため使わない。
アセンブリは Monarch の独自定義 (`src/editor/asmLanguage.ts`) で色付けする。

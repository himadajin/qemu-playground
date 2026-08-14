# 配信・運用仕様

playground を許可された少人数へ安全に配信するための確定構成。
セットアップ手順は [../../user/self-hosting.md](../../user/self-hosting.md) を参照。

## 全体構成

本番は 2 つの入口ホスト名で構成される。

```
ブラウザ
  │ https://qemu-playground.himadajin.com      Access アプリ①(メール allowlist)
  ▼
Cloudflare Worker(静的アセット配信 + /api/* のみ転送)
  │ https://qemu-playground-api.himadajin.com  Access アプリ②(Service Auth)
  ▼                                            Worker が Service Token ヘッダを提示
Cloudflare Tunnel(cloudflared がホストから外向きに張る接続)
  ▼
自己ホストの Docker Compose(api コンテナ :8080 → Run ごとの短命 runner コンテナ)
```

## フロントエンド(Cloudflare Workers)

- カスタムドメイン `qemu-playground.himadajin.com`(`apps/web/wrangler.jsonc` の `routes`)から配信する。
- `dist/` を Workers の static assets として配信し、`/api/*` だけ Worker の fetch handler
  (`apps/web/worker/index.ts`)が `vars.API_ORIGIN`(Tunnel ホスト名)へパス書き換えなしで素通しする
  (`assets.run_worker_first`)。
- Access を迂回できないよう、workers.dev と preview URL は無効化している
  (`workers_dev: false` / `preview_urls: false`)。

## 実行環境(自己ホスト Docker Compose)

- `compose.yaml` で api + runner + cloudflared を構成する。ホストは Docker が動く任意の
  linux/amd64 または linux/arm64 マシンでよい(runner イメージは両アーキテクチャ対応)。
- api はホストへポートを公開しない。外部からの到達経路は Cloudflare Tunnel の public hostname
  `qemu-playground-api.himadajin.com` → `http://api:8080`(compose ネットワーク内)のみで、
  cloudflared だけが外向き接続を持つ。
- Tunnel トークンは gitignore された `.env` の `TUNNEL_TOKEN` で渡す。

## Cloudflare Access

Access アプリは 2 つで、ホスト名ごとに認証方式が異なる。

1. `qemu-playground.himadajin.com`(人間用): Action **Allow**、許可するメールアドレスの
   allowlist。ログインは One-time PIN identity provider による(現在の Zero Trust では
   OTP は既定で有効ではなく、Integrations > Identity providers で一度追加する必要がある)。
2. `qemu-playground-api.himadajin.com`(機械用): Action **Service Auth**、Service Token のみを許可。
   無保護だと URL を知った人が任意コード実行 API を直叩きできるため、正規経路(Worker)以外を遮断する。

- Worker は `/api/*` の転送時に Service Token を `CF-Access-Client-Id` /
  `CF-Access-Client-Secret` ヘッダとして付与する。値は Worker secrets
  `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`(`wrangler secret put`)で渡す。
- Worker は API レスポンスの `Set-Cookie` を必ず除去する。API 側の Access が Service Token
  認証後に発行するセッション Cookie をそのまま転送すると、ブラウザが持つフロントエンド側
  Access アプリのセッション Cookie を同名で上書きし、ユーザーのセッションを壊すためである
  (実装は `apps/web/worker/index.ts`)。

## CI/CD

- `.github/workflows/deploy-web.yml`: `main` への push を起点に、フロントエンドのビルドと
  `wrangler deploy` による Cloudflare Workers へのデプロイを自動化する。
  リポジトリ Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` が未設定の場合、
  デプロイ系ステップは失敗ではなくスキップされ、main へのマージは green のまま保たれる。
- `.github/workflows/ci.yml`: lint / format / typecheck / ユニットテストに加え、
  `api-integration` ジョブが runner イメージをビルドして実 Docker を使う統合テストを実行する。
- 実行環境側のデプロイは自動化しない。自己ホスト上でリポジトリを更新し
  `docker compose build` → `docker compose up -d` を再実行する手動運用とし、
  イメージレジストリへの push・pull は構成に含めない。

# 自己ホスト手順

QEMU Playground を自分のインフラで動かす手順。構成の設計根拠は
[docs/internal/plans/001-prototype/infrastructure.md](../internal/plans/001-prototype/infrastructure.md)
を参照。

全体像: フロントエンド(静的サイト)は Cloudflare Workers から配信し、
実行環境(API サーバー + runner)は任意の linux/amd64 または linux/arm64 ホスト上で Docker Compose
により自己ホストする。両者は Cloudflare Tunnel と Cloudflare Access を介して
1 つのホスト名の下で結び付く。

## 前提

- 自己ホストするマシン: Docker と Docker Compose が動く linux/amd64 または
  linux/arm64 ホスト(例: Raspberry Pi 5)。
- Cloudflare アカウントと、管理下のドメイン(サブドメインを 1 つ playground に割り当てる)。
- フロントエンドのデプロイには Cloudflare Workers への `wrangler deploy` 権限
  (API トークンとアカウント ID)が必要。

## 実行環境(API + runner + cloudflared)

1. 自己ホストするマシンでリポジトリを取得する。
2. `.env.example` を `.env` にコピーし、`TUNNEL_TOKEN` を設定する
   (取得方法は次節)。`.env` はコミットしない。
3. イメージをビルドする。

   ```sh
   docker compose build
   docker compose build runner
   ```

   `runner` サービスは常駐しないため `profiles` で `docker compose up` の対象から
   外れている。ビルドだけは上のように明示的なサービス名で行う
   (`docker compose --profile build-only build` でもよい)。

4. 起動する。

   ```sh
   docker compose up -d
   ```

   `api` はホストへポートを公開しない。外部から到達できるのは `cloudflared`
   経由のみ。`docker compose ps` でホストポートが割り当てられていないことを
   確認できる。

5. 更新時は、リポジトリを更新してから `docker compose build` → `docker compose up -d`
   を再実行する。イメージレジストリへの push・pull は行わない。

## Cloudflare Tunnel(ダッシュボード側の作業)

1. Cloudflare Zero Trust ダッシュボードで Tunnel を 1 つ作成する。
2. 発行された Tunnel トークンを、自己ホストするマシンの `.env` の
   `TUNNEL_TOKEN` に設定する。
3. Tunnel の Public Hostname に、playground 用のサブドメイン(例:
   `play.himadajin.com`)を追加し、サービスとして
   `http://api:8080`(compose ネットワーク内の `api` サービス名)を指す
   HTTP オリジンを設定する。
   - フロントエンドと API は同一オリジンで配信するため(`infrastructure.md`)、
     Public Hostname はこの 1 つだけでよい。`/api/*` の Cloudflare Workers 側の
     素通し設定は次節で行う。

## Cloudflare Access(ダッシュボード側の作業)

1. Zero Trust ダッシュボードで、上記の Public Hostname に対する Access アプリを
   1 つ作成する。
2. 許可する少人数のメールアドレス(または ID プロバイダのグループ)を
   ポリシーに登録する。One-time PIN で十分。

## フロントエンドのデプロイ(Cloudflare Workers)

`main` ブランチへの push を起点に `.github/workflows/deploy-web.yml` が自動デプロイする。
必要な GitHub リポジトリ Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

未設定の場合、ワークフローの `wrangler deploy` ステップが認証エラーで失敗する。

デプロイ前に、`apps/web/wrangler.jsonc` の `vars.API_ORIGIN` を実際の Tunnel
オリジン(`https://play.himadajin.com` など、上で設定した Public Hostname)に
書き換えること。この値は Worker が `/api/*` を素通しする先になる
(`apps/web/worker/index.ts`)。

手動でデプロイ・ローカル確認する場合:

```sh
npm ci
npm run build --workspace @qemu-playground/web
npx --prefix apps/web wrangler deploy   # 要 Cloudflare 認証
npx --prefix apps/web wrangler dev      # ローカルでの動作確認(認証不要)
```

## 動作確認

1. `https://<playground のサブドメイン>/` を開き、Cloudflare Access の認証を
   経て playground が表示されることを確認する。
2. コードを実行し、実行環境(自己ホスト)まで到達して結果が返ることを確認する。

# 自己ホスト手順

QEMU Playground を自分のインフラで動かす手順。構成の確定仕様は
[docs/internal/specs/deployment.md](../internal/specs/deployment.md) を参照。

全体像: フロントエンドは Cloudflare Workers からカスタムドメイン
(例: `qemu-playground.himadajin.com`)で配信し、
実行環境(API サーバー + runner)は自己ホストの Docker Compose で動かす。
API は Cloudflare Tunnel の public hostname(例: `qemu-playground-api.himadajin.com`)
経由でのみ到達でき、両ホスト名を Cloudflare Access で保護する。
以下ではこの 2 つのホスト名を実例として使う。自分のドメインに読み替えること。

> メニュー名は現行の Zero Trust ダッシュボードに合わせている。UI 刷新の途中のため、
> アカウントによっては旧名称(Networks > Tunnels、Access > Applications / Service Auth)で
> 表示されることがある。

## 前提

- 自己ホストするマシン: Docker と Docker Compose が動く linux/amd64 または
  linux/arm64 ホスト(例: x86_64 マシン、Raspberry Pi 5)。
- Cloudflare アカウントと、管理下のドメイン(サブドメインを 2 つ playground に割り当てる)。

## 1. Cloudflare ダッシュボードでの準備

### API トークンと Account ID(フロントエンドのデプロイ用)

1. dash.cloudflare.com 右上のプロフィールアイコン > **My Profile** > **API Tokens** >
   **Create Token** > テンプレート **Edit Cloudflare Workers** を選び、
   Account/Zone Resources を対象アカウントに限定して作成する。
2. **Account ID** は、ダッシュボードでアカウントを開いたときの URL
   `dash.cloudflare.com/<32桁の16進>` の部分に表示される。

### Tunnel(API の経路)

1. Zero Trust ダッシュボード > **Networking** > **Tunnels** > **Create a tunnel**。
2. インストールコマンドの環境選択で **Docker** を選ぶと、コマンド内に `--token eyJ...` が
   含まれる。この token の値だけを控える(コマンド自体は実行しない。cloudflared は
   compose で動かす)。
3. 作成した Tunnel の **Routes** タブ > **Add route** > **Published application** で、
   サブドメイン `qemu-playground-api`、ドメインを選択し、**Service URL** に
   `http://api:8080`(compose ネットワーク内の `api` サービス名)を設定する。

### Access アプリ①: フロントエンド(人間用)

1. メール宛コードでログインさせる場合は、先に一度だけ **Integrations** >
   **Identity providers** > **Add new identity provider** > **One-time PIN** を追加する
   (現在の Zero Trust では One-time PIN は既定で有効ではない)。
2. **Access controls** > **Applications** > **Create new application** > **Self-hosted** で、
   `qemu-playground.himadajin.com` を public hostname として追加する。
3. ポリシーは Action **Allow**、Include > **Emails** に許可するメールアドレスを列挙する。

### Service Token と Access アプリ②: API(機械用)

1. **Access controls** > **Service credentials** > **Service Tokens** >
   **Create Service Token**。表示される **Client ID** と **Client Secret** を控える
   (Secret は作成時にしか表示されない)。
2. **Access controls** > **Applications** で `qemu-playground-api.himadajin.com` の
   Self-hosted アプリをもう 1 つ作成し、ポリシーは Action を **Service Auth** にして
   Include > **Service Token** で作成したトークンを指定する
   (Allow のままだと人間用ログインを要求してしまう)。

## 2. 実行環境(API + runner + cloudflared)

1. 自己ホストするマシンでリポジトリを取得する。
2. `.env.example` を `.env` にコピーし、各値
   (`TUNNEL_TOKEN`、`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、
   `CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`)を設定する。`.env` はコミットしない。
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

## 3. フロントエンドのデプロイ(Cloudflare Workers)

デプロイ前に、`apps/web/wrangler.jsonc` の `routes` を配信ホスト名に、
`vars.API_ORIGIN` を Tunnel の public hostname(`https://qemu-playground-api.himadajin.com` など)に
合わせること。`API_ORIGIN` は Worker が `/api/*` を素通しする先になる
(`apps/web/worker/index.ts`)。

初回デプロイは手動で行う(`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を
環境変数として渡す)。

```sh
npm ci
npm run build --workspace @qemu-playground/web
npx --prefix apps/web wrangler deploy   # 要 Cloudflare 認証
npx --prefix apps/web wrangler dev      # ローカルでの動作確認(認証不要)
```

成功すると `wrangler.jsonc` の設定に従い、カスタムドメイン(DNS 含む)が自動作成される。
workers.dev / preview URL は Access を迂回できないよう無効化されている。

デプロイ後、Service Token を Worker secrets として投入する
(値は Access アプリ②で作成した Client ID / Client Secret)。

```sh
cd apps/web
npx wrangler secret put CF_ACCESS_CLIENT_ID
npx wrangler secret put CF_ACCESS_CLIENT_SECRET
```

## 4. 自動デプロイ(GitHub Actions)

`main` ブランチへの push を起点に `.github/workflows/deploy-web.yml` が自動デプロイする。
必要な GitHub リポジトリ Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

未設定の場合、デプロイ系ステップは失敗ではなくスキップされ、`main` へのマージは
green のまま保たれる(自動デプロイを有効化するまで設定は任意)。

## 5. 動作確認

1. `https://qemu-playground.himadajin.com/` を開き、Cloudflare Access の認証を経て
   playground が表示されることを確認する。
2. コードを実行し、実行環境(自己ホスト)まで到達して結果が返ることを確認する。
3. `https://qemu-playground-api.himadajin.com/api/healthz` へ直接アクセスすると
   Access に遮断される(403)ことを確認する。

# QEMU Playground Infrastructure

## Purpose

playground を許可された少人数へ安全に配信し、運用し続けられる基盤を作る。
フロントエンドは Cloudflare 上の静的サイトとして main マージから自動デプロイされ、実行環境は自己ホストの arm64 ホスト上で Docker Compose により稼働し、外部からは Cloudflare Tunnel 経由でのみ到達でき、全体が Cloudflare Access で保護されている状態を目指す。

## Context

この文書は `design.md` のインフラ・配信・運用の決定領域を所有する companion である。
アプリケーション本体の設計(API の形、runner の実行モデル)は `design.md` と `execution.md` が扱う。

ドメインは Cloudflare 管理下の既存ドメイン `himadajin.com` のサブドメイン 1 つ(例: `play.himadajin.com`)を使う。
同一ホスト名で静的サイトと `/api/*` を配信し、同一オリジンのため CORS は設計に含めない。
具体的なサブドメイン名は実装時の設定値とする。

デプロイ構成は 2 系統に分ける。
フロントエンドは Cloudflare Workers の static assets 機能で配信する。
実行環境(API サーバー + runner)は Raspberry Pi 5 などの arm64 ホスト上で Docker Compose により自己ホストし、Cloudflare Tunnel(cloudflared)経由でのみ外部からアクセス可能にする。
実行環境のホストはインターネットへポートを直接公開しない。

フロントエンドと API は Cloudflare Access で保護し、許可した少人数のみがアクセスできるようにする。
認証は Cloudflare Access(One-time PIN または ID プロバイダ連携)に任せ、Access のアプリはこのホスト名 1 つに対して定義する。

API サーバーのコンテナは Node.js `24.18.0` 系の公式イメージをベースにする。
runner イメージの中身(ツールチェーン構成)は `execution.md` が扱う。

## Direction

フロントエンドは同一オリジンの `/api` を相対パスで呼ぶ。
本番では Cloudflare Workers が静的アセットを配信し、`/api/*` のみ Worker から Tunnel オリジンへ素通しする。
開発時は Vite の proxy でローカルの API サーバーへ中継し、本番と同じ相対パスのまま動くようにする。

自己ホスト側の Docker Compose は、API サーバー、runner イメージ、cloudflared の 3 つを構成要素とし、cloudflared だけが外向き接続を持つ。
API サーバーはホストポートを公開しない。
API サーバーは runner コンテナ起動のため Docker ソケットをマウントする(方針と安全性の判断は `execution.md` が扱う)。

CI/CD は GitHub Actions で初期から構築する。
main ブランチへのマージを起点に、フロントエンドのビルドと `wrangler deploy` による Cloudflare へのデプロイを自動化する。

実行環境側のデプロイは、自己ホスト上でリポジトリを取得し `docker compose build` でイメージをビルドする手動運用とする。
ホストが arm64 のためクロスビルドは不要で、イメージレジストリへの push・pull は構成に含めない。

## Completion Conditions

- 単一リポジトリから、実行環境の Docker イメージ群(API・runner)をビルドできる。
- Docker Compose により、API・runner・cloudflared を自己ホスト環境で起動できる。
- フロントエンドが Cloudflare 上の静的サイトとして `himadajin.com` のサブドメインで配信され、ブラウザから playground を開ける。
- 配信されたフロントエンドから、同一オリジンの `/api/*` と Cloudflare Tunnel 経由で自己ホストの API に Run リクエストが到達し、結果が表示される。
- 実行環境のホストは、Cloudflare Tunnel 以外の経路でインターネットへポートを公開していない。
- フロントエンドと API は Cloudflare Access で保護され、許可されていない利用者はアクセスできない。
- GitHub Actions により、main ブランチへのマージを起点にフロントエンドが Cloudflare へ自動デプロイされる。

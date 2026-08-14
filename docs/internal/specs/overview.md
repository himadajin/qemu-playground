# 全体仕様

QEMU Playground の目的、スコープ、構成の確定仕様。
配信・運用は [deployment.md](deployment.md)、実行モデルは [run-execution.md](run-execution.md)、
画面挙動は [web-frontend.md](web-frontend.md)、API プロトコルは
[../contracts/run-protocol.md](../contracts/run-protocol.md) を参照。

## 目的

ブラウザから C またはアセンブリを入力し、ターゲットアーキテクチャを選択してボタンを押すだけで
コンパイルと QEMU 実行を行い、stdout、stderr、終了コード、コンパイル結果、
C 入力時の生成アセンブリを確認できる Web playground。
プログラマが短いコード片を複数アーキテクチャで素早く試すための実行環境であり、
中心価値は「コードを貼る、ターゲットを選ぶ、必要ならオプションを指定する、実行結果を見る」ことにある。

## スコープ

- 対象言語は C とアセンブリのみ。コンパイラは GCC(`<triplet>-gcc`)に固定する。
- サポートターゲットは RV64(`rv64`)と AArch64(`aarch64`)。
  ターゲットは第一級パラメータとして扱い、追加は runner イメージへの apt パッケージ追加と
  `packages/shared/src/targets.ts` の定義テーブルへの追記で完結する形を保つ。
- 実行モードは全ターゲットで QEMU の Linux user-mode に固定する。
  ホストとターゲットのアーキテクチャが一致する場合もネイティブ実行はせず、一律 QEMU 経由で実行する。
- 1 回の実行で扱う入力は 1 コンパイル単位のみ。ブラウザ側で複数スニペットを保存・切替できても、
  互いにリンクされるプロジェクトではなく独立したスニペットとして扱う。
- 実行するプログラムの標準入力は常に空(即 EOF)として扱う。
- C 入力では、実行結果に加えて readonly な生成アセンブリ(`-S` 相当の出力)を返す。
- アセンブリソースとターゲットの整合はサーバーで検証しない。
  不整合はコンパイルエラーまたは実行時エラーとして自然に返る。
- API は単発の同期 `POST /api/run` のみを持つ。コンパイルオプションは optional な文字列入力とし、
  未指定でも実行できる。

## 目的外

デバッグ機能、GDB、対話型ターミナル、常駐プロセス、標準入力の供給(対話送信・固定入力とも)、
C++、Clang、複数コンパイラ比較、逆アセンブル表示、複数ファイルビルド、
system-mode エミュレーション、ユーザー管理・認証機能、サーバー側永続化、レート制限、
WebSocket、ジョブ履歴・ジョブポーリング。

## リポジトリ構成

npm workspaces によるモノレポ。Node.js のバージョンは `.nvmrc` で管理する。

- `apps/web`: React/Vite の単一画面フロントエンド。同一オリジンの `/api` を相対パスで呼ぶ。
- `apps/api`: Fastify API サーバー。Run ごとに短命 runner コンテナへ実行を委譲する。
- `packages/shared`: ターゲット定義テーブルと `/api/run` の Zod スキーマの単一の情報源。
  フロントエンドと API の型と検証をここから導出する。
- `runner/`: 実行専用コンテナのイメージ定義(ワークスペース外)。
- `compose.yaml`: 自己ホスト実行環境(api + runner + cloudflared)の Docker Compose 定義。

## 結果モデル

Run の結果は、コードの実行結果(HTTP 200: `success` / `compile_error` / `runtime_error` / `timeout`)と、
Run 自体を実行できなかったエラー(HTTP 400 / 429 / 500)の 2 層に分けて扱い、互いに混ぜない。
詳細は [../contracts/run-protocol.md](../contracts/run-protocol.md) を参照。

## 保存と共有

- 保存はブラウザ内のローカル保存のみとし、サーバーにはユーザーコードもスニペットも保存しない。
- 共有 URL はコード、言語、ターゲット、コンパイルオプションを URL 自体に埋め込む
  (URL をキーにしたサーバー側データ呼び出しはしない)。
  詳細は [web-frontend.md](web-frontend.md) を参照。

## ターゲットの追加手順

1. runner イメージ(`runner/Dockerfile`)に対象ターゲットのツールチェーン
   (gcc / binutils / libc ヘッダ)の apt パッケージを追加する。
2. `packages/shared/src/targets.ts` の定義テーブルに行(表示名、ツールチェーンコマンド、
   QEMU バイナリ名、sysroot パスなど)を追記する。

この 2 点で完結しない変更が必要になった場合は、ターゲット抽象の見直しとして扱う。

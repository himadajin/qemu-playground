# Run 実行モデル仕様

1 回の Run がどのように隔離実行され、結果がどう決まるかの確定仕様。
API レスポンスの構造は [../contracts/run-protocol.md](../contracts/run-protocol.md) を参照。
ターゲットごとのコマンドは `packages/shared/src/targets.ts` の定義テーブルを正とする。

## runner イメージ

- `ubuntu:24.04`(linux/amd64 / linux/arm64 両対応)単一イメージに全ターゲットのツールチェーンを同居させる。
- apt のみでインストールする: `gcc-riscv64-linux-gnu` / `binutils-riscv64-linux-gnu` / `libc6-dev-riscv64-cross`(RV64、両アーキテクチャ共通)、
  AArch64 は amd64 ホストではクロスツールチェーン(`gcc-aarch64-linux-gnu` / `binutils-aarch64-linux-gnu` / `libc6-dev-arm64-cross`)、
  arm64 ホストではネイティブ(`gcc` / `binutils` / `libc6-dev`、triplet 付きコマンドを提供)、`qemu-user`(QEMU 8.2 系)。
- AArch64 の QEMU sysroot はどちらのホストでも `/usr/aarch64-linux-gnu` に統一する
  (amd64 では実ディレクトリ、arm64 では `/` へのシンボリックリンク)。
- コンパイル・実行は非 root(`ubuntu`、uid/gid 1000)で行う。

## コンテナライフサイクル

- API は Run ごとに短命 runner コンテナを Docker ソケット経由の兄弟コンテナとして起動する。
  ソケットは API コンテナにのみマウントし、他のコンテナには渡さない。
  API コンテナが侵害された場合にホストの Docker を握られるトレードオフは、
  Cloudflare Access で利用者を許可した少人数に限定している前提で許容する。
- bind mount は使わない。ソース・ドライバスクリプト・argv ファイルは put archive で `/work` へ注入し、
  成果物(ログ、stdout/stderr、生成アセンブリ、メタ情報)は get archive で回収する。
  これにより API がホスト直実行でもコンテナ内実行でも同一コードで動く。
- コンテナはネットワーク無効、CapDrop ALL、no-new-privileges、CPU/メモリ/PID 制限付きで起動し、
  終了・失敗・タイムアウトのいずれでも必ず削除する。
- ユーザー入力はシェル解釈を通らない。コマンドは NUL 区切りの argv ファイルとして渡し、
  コンテナ内スクリプトが配列として読み戻して直接 exec する。

## フェーズと結果判定

1. コンパイル: `<gccCommand> [opts] -o prog prog.c`(asm 入力は `-nostdlib` 付きで `prog.s`)
2. 生成アセンブリ(C のみ): 同一オプションで `-S`。失敗しても Run は失敗にせず、空のアセンブリ + コンパイルログに理由を残す
3. 実行: `<qemuBinary> -L <qemuSysroot> ./prog`。ネイティブターゲットも一律 QEMU 経由で、実行経路に条件分岐を持たない。
   標準入力は `/dev/null`(即 EOF)

- 各フェーズはコンテナ内で `timeout` により制限し、status 124/137 かつ実測経過時間が制限に達した場合のみ
  そのフェーズのタイムアウトと判定する(プログラム自身が 124 を返すケースと誤同一視しない)。
- API 側にも全体 watchdog を置き、コンテナがハングした場合は強制削除して timeout として報告する。
- ゲストプログラムがシグナルで異常終了すると QEMU プロセスが 128+n で終了する。これを `runtime_error` +
  シグナル名(Linux のシグナル番号表に基づく)として報告する。プログラムが自発的に `exit(139)` する場合とは
  wait status 上区別できない(既知の制約)。
- 上記以外の終了は終了コードに関わらず `success` として終了コードを報告する。

## 制限値(env で設定可能、括弧内は初期値)

- 同時実行数 `MAX_CONCURRENT_RUNS`(2)。超過はキューに入れず即 429
- コンパイル時間 `COMPILE_TIMEOUT_MS`(10000)/ 実行時間 `RUN_TIMEOUT_MS`(5000)
- CPU `RUNNER_CPUS`(1)/ メモリ `RUNNER_MEMORY_MB`(256)/ PID `RUNNER_PIDS_LIMIT`(64)
- 出力上限 `MAX_OUTPUT_BYTES`(65536)。コンパイルログ、stdout、stderr、生成アセンブリに個別適用し、
  超過分は切り捨てて切り捨てフラグを立てる

全 env の一覧と正確な既定値は `apps/api/README.md` と `apps/api/src/config.ts` を正とする。

## コンパイルオプション

- リクエストの `compileOptions` は空白で分割し、シェルを介さず引数配列として扱う。
- default-deny の allowlist で検証する。最適化・警告・言語規格・コード生成系(`-O*`、`-g*`、`-W*`、`-std=*`、
  `-f*`、`-m*`、`-D*`/`-U*` など)を許可し、出力先変更・ファイル参照・リンカ/プリプロセッサ直渡し
  (`-o`、`-include`、`-Wl,*`、`@file` など)は拒否する。拒否は HTTP 400。
- 完全な allowlist は `apps/api/src/compile-options.ts` と `apps/api/README.md` を正とする。

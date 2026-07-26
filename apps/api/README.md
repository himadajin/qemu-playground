# apps/api

QEMU Playground の API サーバー。`POST /api/run` を唯一の実行エンドポイントとし、
Run ごとに短命 runner コンテナを起動してコンパイルと QEMU user-mode 実行を行う。

- プロトコル: [docs/internal/contracts/run-protocol.md](../../docs/internal/contracts/run-protocol.md)
- リクエスト/レスポンスの正: `packages/shared/src/protocol.ts` の Zod スキーマ
- ターゲット定義の正: `packages/shared/src/targets.ts`
- 実行隔離の方針: [docs/internal/plans/001-prototype/execution.md](../../docs/internal/plans/001-prototype/execution.md)

## 起動

runner イメージが必要。

```sh
docker build -t qemu-playground-runner:dev runner/
```

```sh
npm install
npm run dev  --workspace @qemu-playground/api   # 変更監視つき
npm run start --workspace @qemu-playground/api  # 単発起動
```

既定では `0.0.0.0:8080` を listen する(`apps/web` の dev proxy は `http://localhost:8080` を前提にする)。

```sh
npm run typecheck --workspace @qemu-playground/api
npm run test      --workspace @qemu-playground/api  # 統合テストは実 Docker を使う
```

`test/integration.test.ts` は実 runner コンテナ(linux/arm64 の
`qemu-playground-runner:dev`)を起動する。x86_64 の CI などこのイメージが動かせない
環境では、環境変数 `API_SKIP_INTEGRATION_TESTS=1` を立てるとこのファイルだけ除外される
(`vitest.config.ts` 参照)。他のテストファイルはスタブ runner を使うため Docker 不要。

## コンテナ化

本番運用は Docker Compose による自己ホストを前提にする。
`apps/api/Dockerfile` はモノレポの npm workspaces 構成を前提にしており、
ビルドコンテキストはリポジトリルート(`compose.yaml` 参照)。
手順は [docs/user/self-hosting.md](../../docs/user/self-hosting.md) を参照。

## エンドポイント

| メソッド | パス            | 内容                                                       |
| -------- | --------------- | ---------------------------------------------------------- |
| `POST`   | `/api/run`      | 1 回の Run。実行結果は常に HTTP 200(`RunResultSchema`)     |
| `GET`    | `/api/healthz`  | `{"status":"ok"}`                                           |

Run 自体を実行できなかった場合だけ HTTP エラーになり、`RunErrorResponseSchema` を返す。

- `400 invalid_request`: リクエストが不正、または `compileOptions` が allowlist 外
- `429 capacity_exceeded`: 同時実行上限超過(キューに入れず即座に拒否)
- `500 internal_error`: runner コンテナの起動失敗など

## 環境変数

| 変数                  | 既定値                       | 内容                                                     |
| --------------------- | ---------------------------- | -------------------------------------------------------- |
| `HOST`                | `0.0.0.0`                    | listen アドレス                                          |
| `PORT`                | `8080`                       | listen ポート                                            |
| `RUNNER_IMAGE`        | `qemu-playground-runner:dev` | runner コンテナのイメージ                                |
| `DOCKER_SOCKET_PATH`  | `/var/run/docker.sock`       | 兄弟コンテナ起動に使う Docker ソケット                   |
| `MAX_CONCURRENT_RUNS` | `2`                          | 同時実行数の上限                                         |
| `COMPILE_TIMEOUT_MS`  | `10000`                      | コンパイル段階の時間制限                                 |
| `RUN_TIMEOUT_MS`      | `5000`                       | 実行段階の時間制限                                       |
| `WATCHDOG_EXTRA_MS`   | `15000`                      | API 側バックストップの追加猶予(下記参照)               |
| `RUNNER_CPUS`         | `1`                          | runner コンテナの CPU 割当                               |
| `RUNNER_MEMORY_MB`    | `256`                        | runner コンテナのメモリ上限                              |
| `RUNNER_PIDS_LIMIT`   | `64`                         | runner コンテナのプロセス数上限                          |
| `MAX_OUTPUT_BYTES`    | `65536`                      | compileLog / stdout / stderr / 生成アセンブリの各サイズ上限 |

## 実行モデル

Run ごとに、Docker ソケット経由で短命な兄弟コンテナを起動する。
bind mount は使わない。本番では API 自体がコンテナ内で動きソケットだけをマウントするため、
ホストパス基準の bind mount が成立しないからである。
代わりに、作成 → `putArchive` でソース注入 → 起動 → 完了待ち → `getArchive` で成果物回収 → 削除、という
アーカイブ経由の受け渡しにしている。開発機(macOS 上で直接起動)と本番で同じコードが動く。

コンテナは `NetworkDisabled` + `--network none`、CPU / メモリ / PID 制限つき、
`CapDrop: ALL`、`no-new-privileges`、ユーザー `1000:1000`(runner イメージの `ubuntu`)で起動する。
成功・失敗・タイムアウトのいずれでも、最後に必ず `force` 付きで削除する。

コンテナ内では固定スクリプト `src/runner/run.sh` が動く。
リクエスト由来の文字列はスクリプトへ一切埋め込まない。
3 つのコマンドラインは NUL 区切りの argv ファイル(`compile.argv` / `asm.argv` / `run.argv`)として渡し、
bash 側は `mapfile -t -d ''` で配列に戻す。制限値は環境変数で渡す。
これによりユーザー入力がシェル解釈に触れない。

スクリプトの流れ:

1. **コンパイル段階** — `<gccCommand> [opts] -o prog prog.c`(asm 入力は `<gccCommand> -nostdlib [opts] -o prog prog.s`)。
2. **生成アセンブリ**(C 入力のみ) — `<gccCommand> [opts] -S -o out.s prog.c`。
   実行用ビルドが成功していれば、ここでの失敗は Run 全体の失敗にしない。
   `out.s` を削除し、失敗内容を `compile.log` に追記する(結果は `assembly.available: true` / `code: ""`)。
3. **実行段階** — `<qemuBinary> -L <qemuSysroot> ./prog`。stdin は `/dev/null`(常に即 EOF)。
   stdout / stderr は別々のファイルへリダイレクトし、プログラムの出力だけを回収する。

ネイティブターゲット(arm64 ホスト上の AArch64)でも QEMU を経由し、`-L` も必ず付ける。
実行経路をターゲット間で分岐させないためである。

### タイムアウトとフェーズ判別

各段階は `timeout -k 1 <limit>` で個別に囲む。GNU `timeout` は時間超過時に 124(追い打ちの KILL が
必要だった場合は 137)を返すので、その終了ステータスと、スクリプトが記録した実測経過時間の両方が
制限に達している場合にだけタイムアウトと判定する。プログラムが自分で 124 を返しただけのケースを
タイムアウトと誤認しない。これで `timeoutPhase` が `compile` / `run` のどちらかに正確に決まる。

API 側には別途ウォッチドッグがある。`COMPILE_TIMEOUT_MS × 2 + RUN_TIMEOUT_MS + WATCHDOG_EXTRA_MS`
を過ぎてもコンテナが終わらない場合(`timeout` では止められないハング)、コンテナを強制停止する。
この場合は到達していた段階を `timeoutPhase` として `timeout` を返す。通常のタイムアウト経路ではない。

### 終了コードとシグナル

QEMU user-mode はゲストの未捕捉シグナルを自分自身に再送出するため、ゲストがシグナルで死ぬと
`qemu-<arch>` プロセスが 128+n で終わる(runner イメージで実測: SIGSEGV → 139、SIGABRT → 134、
rv64 / AArch64 とも)。

- 128+n が既知の Linux シグナル番号 → `runtime_error` + `signal`(`"SIGSEGV"` など)
- それ以外 → `success` + `exitCode`(非ゼロでも `success`)

シグナル名は Linux の番号表をコード内に持つ。開発機が macOS の場合 `os.constants.signals` は
番号が一部異なるため、ホストから引くと誤ったシグナル名になる。

なお、プログラムが自分で `exit(139)` した場合と SIGSEGV で死んだ場合は wait ステータス上
区別できない。これはこの符号化に内在する曖昧さとして受け入れている。

### 出力サイズ上限

`compile.log` / `stdout.txt` / `stderr.txt` / `out.s` は、コンテナ内で `MAX_OUTPUT_BYTES + 1` バイトに
切り詰めてから回収する。暴走した出力で転送量が膨らまないようにするためで、
1 バイト余分に残すことで「ちょうど上限」と「切り捨てられた」を API 側で区別できる。
上限を超えていた場合、対応する `*Truncated` フラグを立てる。

## compileOptions の allowlist

`compileOptions` はシェルを介さず引数配列に分割する(クォートと `\` エスケープは解釈するが、
展開・置換・コマンド実行は一切行わない)。分割後の各トークンを次の規則で検証し、
1 つでも通らなければ HTTP 400 `invalid_request` を返す。message には該当トークンを含める。

既定は拒否。以下のいずれかに当てはまるものだけ通す。

**そのまま許可(完全一致)**

`-O` `-O0` `-O1` `-O2` `-O3` `-Os` `-Og` `-Ofast`
`-g` `-g0` `-g1` `-g2` `-g3` `-ggdb`
`-w` `-ansi` `-pedantic` `-pedantic-errors`
`-static` `-static-pie` `-pie` `-no-pie` `-nostdlib` `-nostartfiles` `-nodefaultlibs` `-pthread`

**接頭辞で許可**

`-std=` `-W` `-f` `-m` `-D` `-U`

オペランドはフラグに続けて書く(`-DFOO=1`。`-D FOO=1` は 2 トークン目が `-` 始まりでないため拒否)。

**上の接頭辞に当たっても拒否**

- 他ツールへ任意の文字列を渡すもの: `-Wl,` `-Wa,` `-Wp,`
- ファイルを読み書きするもの: `-fplugin*` `-fprofile*` `-fdump*` `-fopt-info*` `-fstack-usage`
  `-fsave-optimization-record` `-fcallgraph-info` `-fdiagnostics-format*` `-fcompare-debug` `-frepo`
  `-fmodule*` `-fworking-directory` `-fdebug-prefix-map*` `-ffile-prefix-map*` `-fmacro-prefix-map*`
  `-fsanitize-coverage*`

**規定により拒否されるもの(例)**

`-o` `-S` `-c` `-E`(runner が前提にする出力先・コンパイル段階を変える)、
`-I` `-L` `-l` `-B` `-include` `-imacros` `-isystem` `-specs=` `-MF` `-MD` `-Xlinker`(ファイル参照)、
`@file`(レスポンスファイル)、`-` で始まらないトークン(追加のソース/オブジェクトファイル)。

上限として、`compileOptions` は 2048 文字・64 トークンまで。

許可されたオプションは、実行用ビルドと `-S` ビルドの両方に同じものを渡す。
表示される生成アセンブリが、実際に走ったバイナリのコード生成と一致するようにするためである。

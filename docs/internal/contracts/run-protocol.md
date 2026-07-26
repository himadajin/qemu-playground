# Run プロトコル(POST /api/run)

Web フロントエンドと API サーバー間の唯一の実行エンドポイント。
リクエスト/レスポンスの厳密なフィールド定義は `packages/shared/src/protocol.ts` の Zod スキーマを正とする。
この文書はその論理的な構造と意味を説明するものであり、フィールド名・型・要否が食い違った場合はスキーマ側が正しい。

ターゲット(`rv64` / `aarch64`)の定義(表示名、コンパイラコマンド、QEMU バイナリ名、sysroot パス)は
`packages/shared/src/targets.ts` の静的テーブルを唯一の情報源とする。
ターゲットの追加は、runner イメージへの apt パッケージ追加とこのテーブルへの追記で完結する。

## リクエスト

- `language`: `"c" | "asm"`
- `target`: ターゲット定義テーブルに存在する id(`"rv64" | "aarch64"`)
- `code`: ソースコード文字列。上限(`MAX_CODE_LENGTH`、64KiB)を超えるものは不正リクエストとして扱う。
- `compileOptions`: 追加コンパイルオプション。省略または空文字列はどちらも「追加オプションなし」を意味する。

## 結果の 2 層構造

Run のレスポンスは 2 つの独立した層に分かれ、互いに混ざらない。

1. **実行結果(HTTP 200)**: Run 自体は実行され、その結果として success / compile_error / runtime_error / timeout のいずれかになった状態。
   コンパイルエラー、実行時エラー、タイムアウトはすべて正常な API 呼び出しであり、200 で返す。
2. **エラーレスポンス(HTTP 400 / 429 / 500)**: Run 自体を開始・完了できなかった状態。リクエスト不正、同時実行上限超過、サーバー内部エラーを指す。
   実行結果のフィールド(`status` など)は一切含まない、別スキーマ(`error.code` / `error.message`)で返す。

## 実行結果(HTTP 200 ボディ)

`status` は次の 4 値のいずれかを取る。

- `success`: ビルドが成功し、プログラムがシグナルで異常終了せずに終了した。
  終了コードが 0 以外でも `success` として扱う(非ゼロ終了コードは正常終了の一種であり、判断は `exitCode` の表示に委ねる)。
- `compile_error`: ビルド自体が失敗し、実行は行われなかった。
- `runtime_error`: ビルドは成功したが、プログラムがシグナルにより異常終了した(セグメンテーションフォルトなど)。
- `timeout`: 時間制限を超過した。`timeoutPhase`(`"compile" | "run"`)により、コンパイル段階と実行段階のどちらで発生したかを判別できる。

すべての `status` に共通して、コンパイルログ(`compileLog`)とその切り捨てフラグ(`compileLogTruncated`)を含む。

実行段階に到達した場合(`success` / `runtime_error` / 実行段階の `timeout`)は、標準出力・標準エラー出力とそれぞれの切り捨てフラグを含む。
実行段階に到達していない場合(`compile_error` / コンパイル段階の `timeout`)は、これらのフィールドを含まない。

終了コードとシグナルは区別して持つ。

- `success` は `exitCode`(数値)を持つ。
- `runtime_error` は `signal`(`"SIGSEGV"` などのシンボル名)を持つ。
- `compile_error` と `timeout` はどちらも持たない(プロセスが終了に至っていないため)。

C 入力時の生成アセンブリは `assembly` フィールドで表す。

- `assembly.available === false`: この Run にはアセンブリが適用されない(入力言語が asm、またはビルドが実行用バイナリを生成する段階に到達しなかった)。
- `assembly.available === true`: 実行用ビルドが成功した C 入力であることを示す。`code`(生成アセンブリ文字列)と `truncated`(切り捃てフラグ)を持つ。
  生成アセンブリの取得自体(`-S` 相当の別コンパイル)が失敗した場合でも実行用ビルドが成功していれば Run 全体は失敗として扱わず、`code` を空文字列・`truncated` を `false` とし、失敗の内容は `compileLog` から読めるようにする。

`assembly` は `success` と `runtime_error` では必ず含まれ、実行段階の `timeout` では含まれる場合がある(コンパイルが成功してから実行段階でタイムアウトした場合)。
`compile_error` とコンパイル段階の `timeout` には含まれない。

## エラーレスポンス(HTTP 400 / 429 / 500 ボディ)

`error.code` は次のいずれか。

- `invalid_request`(HTTP 400): 未知のターゲット指定、上限超過のコード長など、リクエストが不正な場合。
- `capacity_exceeded`(HTTP 429): 同時実行数の上限を超えたため、Run を待ち行列に入れず即座に拒否した場合。
- `internal_error`(HTTP 500): runner コンテナの起動失敗など、サーバー側の予期しない失敗。

`error.message` は人間可読な説明を持つ。

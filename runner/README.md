# runner

Run ごとに起動する短命実行コンテナのイメージ定義を置く。
npm workspace には含めない。

仕様は [docs/internal/plans/001-prototype/execution.md](../docs/internal/plans/001-prototype/execution.md) を参照。

## イメージ内容

- ベース: `ubuntu:24.04`(linux/amd64 / linux/arm64 両対応)
- パッケージ(apt、`--no-install-recommends`):
  - RV64(両アーキテクチャ共通): `gcc-riscv64-linux-gnu`、`binutils-riscv64-linux-gnu`、`libc6-dev-riscv64-cross`
  - AArch64(amd64 ホスト): `gcc-aarch64-linux-gnu`、`binutils-aarch64-linux-gnu`、`libc6-dev-arm64-cross`
    (クロス sysroot `/usr/aarch64-linux-gnu` が実体として置かれる)
  - AArch64(arm64 ホスト): `gcc`、`binutils`、`libc6-dev`(triplet 付き `aarch64-linux-gnu-*` コマンドが提供される)。
    加えて `/usr/aarch64-linux-gnu` → `/` のシンボリックリンクを作り、sysroot パスを amd64 と統一する
  - 実行: `qemu-user`(QEMU 8.2.2、`qemu-riscv64` / `qemu-aarch64` を提供)
- ユーザー: `ubuntu:24.04` 既定の非 root ユーザー `ubuntu`(uid/gid 1000)。コンパイル・実行はこのユーザーで行う。
- 作業ディレクトリ: `/work`(実際のマウントは API サーバー側の責務)

`gcc` は `libc6-dev` / `libc6-dev-*-cross` を Recommends としてのみ要求するため、
`--no-install-recommends` を使う場合はヘッダ・静的ライブラリ一式として明示インストールが必要。

## ビルド

```sh
docker build -t qemu-playground-runner:dev runner/
```

## 使用例

コンテナ内(`ubuntu` ユーザー、`/work` に入力ファイルをマウントした状態)での実行例。

### RV64

```sh
riscv64-linux-gnu-gcc -o hello hello.c
qemu-riscv64 -L /usr/riscv64-linux-gnu ./hello
```

動的リンク(デフォルト)のバイナリは `-L /usr/riscv64-linux-gnu` の指定が必須。
指定しないと `qemu-riscv64` が動的リンカ(`/lib/ld-linux-riscv64-lp64d.so.1`)を解決できず失敗する。

### AArch64

```sh
aarch64-linux-gnu-gcc -o hello hello.c
qemu-aarch64 -L /usr/aarch64-linux-gnu ./hello
```

sysroot パスはホストアーキテクチャによらず `/usr/aarch64-linux-gnu` で統一している
(amd64 では実ディレクトリ、arm64 では `/` へのシンボリックリンク)。

### アセンブリ出力

```sh
riscv64-linux-gnu-gcc -S -o hello.s hello.c
aarch64-linux-gnu-gcc -S -o hello.s hello.c
```

### `_start` を定義するアセンブリ(`-nostdlib`)

```sh
riscv64-linux-gnu-gcc -nostdlib -o start start.s
qemu-riscv64 -L /usr/riscv64-linux-gnu ./start

aarch64-linux-gnu-gcc -nostdlib -o start start.s
qemu-aarch64 -L /usr/aarch64-linux-gnu ./start
```

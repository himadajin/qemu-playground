# syntax=docker/dockerfile:1
# linux/amd64 と linux/arm64 の両対応。RV64 は常にクロスツールチェーン、
# AArch64 は amd64 ではクロスツールチェーン、arm64 ではネイティブの
# triplet 付きコマンドを使い、実行はどちらも qemu-user 経由に統一する。
# AArch64 の sysroot はどちらのホストでも /usr/aarch64-linux-gnu に統一する
# (amd64 では実体、arm64 では / へのシンボリックリンク)。
FROM ubuntu:24.04

# gcc は libc6-dev / libc6-dev-*-cross を Recommends としてのみ要求するため、
# --no-install-recommends を使う場合は明示インストールが必要。
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc-riscv64-linux-gnu \
    binutils-riscv64-linux-gnu \
    libc6-dev-riscv64-cross \
    qemu-user \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
    amd64) \
    apt-get install -y --no-install-recommends \
    gcc-aarch64-linux-gnu \
    binutils-aarch64-linux-gnu \
    libc6-dev-arm64-cross \
    ;; \
    arm64) \
    apt-get install -y --no-install-recommends \
    gcc \
    binutils \
    libc6-dev \
    && if [ ! -e /usr/aarch64-linux-gnu ]; then ln -s / /usr/aarch64-linux-gnu; fi \
    ;; \
    *) \
    echo "unsupported architecture: $arch" >&2; exit 1 \
    ;; \
    esac \
    && rm -rf /var/lib/apt/lists/*

# ubuntu:24.04 が持つ既定の非 root ユーザー(uid/gid 1000)をそのまま使う。
USER ubuntu
WORKDIR /work

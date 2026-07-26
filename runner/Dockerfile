# syntax=docker/dockerfile:1
# linux/arm64 前提。RV64 はクロスツールチェーン、AArch64 はネイティブの
# triplet 付きコマンド、実行はどちらも qemu-user 経由に統一する。
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc-riscv64-linux-gnu \
    binutils-riscv64-linux-gnu \
    libc6-dev-riscv64-cross \
    gcc \
    binutils \
    libc6-dev \
    qemu-user \
    && rm -rf /var/lib/apt/lists/*

# ubuntu:24.04 が持つ既定の非 root ユーザー(uid/gid 1000)をそのまま使う。
USER ubuntu
WORKDIR /work

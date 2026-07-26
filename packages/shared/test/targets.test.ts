import { describe, expect, it } from "vitest";
import {
  getTargetDefinition,
  TARGET_IDS,
  TARGETS,
  TargetIdSchema,
} from "../src/targets.js";

describe("target definition table", () => {
  it("defines exactly rv64 and aarch64", () => {
    expect(TARGET_IDS).toEqual(["rv64", "aarch64"]);
    expect(TARGETS.map((t) => t.id)).toEqual(["rv64", "aarch64"]);
  });

  it("gives every target a distinct gcc command and qemu binary", () => {
    const gccCommands = new Set(TARGETS.map((t) => t.gccCommand));
    const qemuBinaries = new Set(TARGETS.map((t) => t.qemuBinary));
    expect(gccCommands.size).toBe(TARGETS.length);
    expect(qemuBinaries.size).toBe(TARGETS.length);
  });

  it("resolves the expected toolchain for rv64", () => {
    const rv64 = getTargetDefinition("rv64");
    expect(rv64.displayName).toBe("RV64");
    expect(rv64.gccCommand).toBe("riscv64-linux-gnu-gcc");
    expect(rv64.qemuBinary).toBe("qemu-riscv64");
    expect(rv64.qemuSysroot).toBe("/usr/riscv64-linux-gnu");
  });

  it("resolves the expected toolchain for aarch64", () => {
    const aarch64 = getTargetDefinition("aarch64");
    expect(aarch64.displayName).toBe("AArch64");
    expect(aarch64.gccCommand).toBe("aarch64-linux-gnu-gcc");
    expect(aarch64.qemuBinary).toBe("qemu-aarch64");
    expect(aarch64.qemuSysroot).toBe("/");
  });

  it("accepts only known target ids via TargetIdSchema", () => {
    expect(TargetIdSchema.safeParse("rv64").success).toBe(true);
    expect(TargetIdSchema.safeParse("aarch64").success).toBe(true);
    expect(TargetIdSchema.safeParse("riscv32").success).toBe(false);
    expect(TargetIdSchema.safeParse("").success).toBe(false);
  });
});

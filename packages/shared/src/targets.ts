import { z } from "zod";

/**
 * Static target definition table.
 *
 * This is the single source of truth for supported target architectures,
 * consumed by both apps/web (target picker, sample selection) and apps/api
 * (resolving the toolchain/QEMU commands to run inside the runner container).
 *
 * Adding a target is meant to be: add the required apt packages to the
 * runner image, then append one entry here.
 */
const TARGET_DEFINITIONS = [
  {
    id: "rv64",
    displayName: "RV64",
    gccCommand: "riscv64-linux-gnu-gcc",
    qemuBinary: "qemu-riscv64",
    qemuSysroot: "/usr/riscv64-linux-gnu",
  },
  {
    id: "aarch64",
    displayName: "AArch64",
    gccCommand: "aarch64-linux-gnu-gcc",
    qemuBinary: "qemu-aarch64",
    qemuSysroot: "/usr/aarch64-linux-gnu",
  },
] as const satisfies readonly {
  id: string;
  displayName: string;
  gccCommand: string;
  qemuBinary: string;
  qemuSysroot: string;
}[];

export type TargetDefinition = (typeof TARGET_DEFINITIONS)[number];

export type TargetId = TargetDefinition["id"];

/** Ordered list of every target definition. */
export const TARGETS: readonly TargetDefinition[] = TARGET_DEFINITIONS;

/** Ordered tuple of every target id, suitable for `z.enum`. */
export const TARGET_IDS = TARGET_DEFINITIONS.map((target) => target.id) as [
  TargetId,
  ...TargetId[],
];

const TARGET_BY_ID = new Map<TargetId, TargetDefinition>(
  TARGET_DEFINITIONS.map((target) => [target.id, target]),
);

/** Looks up the definition for a target id known to be valid. */
export function getTargetDefinition(id: TargetId): TargetDefinition {
  const definition = TARGET_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown target id: ${id}`);
  }
  return definition;
}

/** Zod schema for a target id, derived from the definition table above. */
export const TargetIdSchema = z.enum(TARGET_IDS);

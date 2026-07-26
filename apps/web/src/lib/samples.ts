import type { Language, TargetId } from "@qemu-playground/shared";

/**
 * Sample code for every (language, target) pair.
 *
 * Per design.md these are short programs that print to stdout when run as-is;
 * they are not a tutorial collection and carry no explanatory comments beyond
 * what the assembly needs to stay readable.
 */

const C_HELLO = `#include <stdio.h>

int main(void) {
    printf("hello from qemu-playground\\n");
    return 0;
}
`;

const RV64_ASM = `    .global _start

    .section .rodata
msg:
    .ascii "hello from rv64 asm\\n"
    .set msg_len, . - msg

    .section .text
_start:
    # write(1, msg, msg_len)
    li a7, 64          # sys_write
    li a0, 1           # fd = stdout
    la a1, msg
    li a2, msg_len
    ecall

    # exit(42)
    li a7, 93          # sys_exit
    li a0, 42          # exit code
    ecall
`;

const AARCH64_ASM = `    .global _start

    .section .rodata
msg:
    .ascii "hello from aarch64 asm\\n"
    .set msg_len, . - msg

    .section .text
_start:
    // write(1, msg, msg_len)
    mov x8, #64        // sys_write
    mov x0, #1         // fd = stdout
    ldr x1, =msg
    mov x2, #msg_len
    svc #0

    // exit(42)
    mov x8, #93        // sys_exit
    mov x0, #42        // exit code
    svc #0
`;

const SAMPLES: Record<Language, Record<TargetId, string>> = {
  c: {
    rv64: C_HELLO,
    aarch64: C_HELLO,
  },
  asm: {
    rv64: RV64_ASM,
    aarch64: AARCH64_ASM,
  },
};

/** Sample source for a (language, target) pair. */
export function getSample(language: Language, target: TargetId): string {
  return SAMPLES[language][target];
}

/**
 * True when `code` is still exactly the sample of some (language, target)
 * pair, i.e. the user has not typed anything of their own. Switching language
 * or target only swaps in a new sample while this holds, so user edits are
 * never discarded.
 */
export function isUntouchedSample(code: string): boolean {
  return Object.values(SAMPLES).some((byTarget) =>
    Object.values(byTarget).some((sample) => sample === code),
  );
}

export const DEFAULT_LANGUAGE: Language = "c";
export const DEFAULT_TARGET: TargetId = "rv64";

import type { TargetId } from "@qemu-playground/shared";

/** Source snippets shared by the integration tests. */

export const C_HELLO = `#include <stdio.h>

int main(void) {
  printf("hello from C\\n");
  fprintf(stderr, "on stderr\\n");
  return 0;
}
`;

export const C_EXIT_42 = `int main(void) { return 42; }
`;

export const C_SEGFAULT = `#include <stdio.h>

int main(void) {
  printf("about to fault\\n");
  fflush(stdout);
  int *p = 0;
  *p = 1;
  return 0;
}
`;

export const C_COMPILE_ERROR = `int main(void) { return nosuchsymbol; }
`;

/** Writes far more than any reasonable output cap, on both streams. */
export const C_CHATTY = `#include <stdio.h>

int main(void) {
  for (int i = 0; i < 4000; i++) {
    printf("stdout line %d\\n", i);
    fprintf(stderr, "stderr line %d\\n", i);
  }
  return 0;
}
`;

export const C_INFINITE_LOOP = `int main(void) { for (;;) { } return 0; }
`;

/**
 * `_start` written by hand: writes to fd 1 and exits with 42, using the
 * Linux generic syscall numbers (write = 64, exit = 93) that both targets
 * share.
 */
export const ASM_EXIT_42: Record<TargetId, string> = {
  rv64: `    .text
    .globl _start
_start:
    li   a7, 64
    li   a0, 1
    lla  a1, msg
    li   a2, 6
    ecall
    li   a7, 93
    li   a0, 42
    ecall
msg:
    .ascii "hello\\n"
`,
  aarch64: `    .text
    .globl _start
_start:
    mov  x0, #1
    adr  x1, msg
    mov  x2, #6
    mov  x8, #64
    svc  #0
    mov  x0, #42
    mov  x8, #93
    svc  #0
msg:
    .ascii "hello\\n"
`,
};

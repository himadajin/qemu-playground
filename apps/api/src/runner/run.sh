#!/bin/bash
# Drives one Run inside the runner container. Injected into /work by apps/api.
#
# Nothing from the request is interpolated into this file: the three command
# lines arrive as NUL-separated argv files that bash reads back into real
# arrays, and the limits arrive as environment variables. User input therefore
# never reaches shell parsing.
#
# Everything produced is left in /work for the API to collect:
#   compile.log  combined output of the exec build (plus the -S build's output
#                only when that build failed)
#   out.s        generated assembly, for C input whose -S build succeeded
#   stdout.txt   the program's standard output
#   stderr.txt   the program's standard error
#   meta.txt     key=value lines describing each phase
set -u
cd /work || exit 90

CAP=$((MAX_OUTPUT_BYTES + 1))

: > compile.log
: > stdout.txt
: > stderr.txt
: > meta.txt

meta() { printf '%s=%s\n' "$1" "$2" >> meta.txt; }

now_ms() { date +%s%3N; }

# Keep every collected file just above the reported cap: one extra byte is
# enough for the API to tell "exactly at the cap" from "truncated", and it
# stops a runaway program from making the archive transfer unbounded.
cap_file() {
  local f=$1 size
  [ -f "$f" ] || return 0
  size=$(stat -c %s "$f")
  if [ "$size" -gt "$CAP" ]; then
    truncate -s "$CAP" "$f"
  fi
}

finish() {
  rm -f prog compile.argv asm.argv run.argv
  cap_file compile.log
  cap_file stdout.txt
  cap_file stderr.txt
  cap_file out.s
  meta finished 1
  exit 0
}

mapfile -t -d '' COMPILE_CMD < compile.argv
mapfile -t -d '' RUN_CMD < run.argv

# --- compile phase -----------------------------------------------------------
start=$(now_ms)
timeout -k 1 "$COMPILE_TIMEOUT_S" "${COMPILE_CMD[@]}" >> compile.log 2>&1
compile_rc=$?
meta compile_ms "$(( $(now_ms) - start ))"
meta compile_rc "$compile_rc"

if [ "$compile_rc" -ne 0 ]; then
  finish
fi

# --- generated assembly (C input only) ---------------------------------------
# A failure here never fails the Run: the exec build already succeeded, so the
# assembly is simply reported as empty and the reason goes to the compile log.
if [ -f asm.argv ]; then
  mapfile -t -d '' ASM_CMD < asm.argv
  asm_log=$(timeout -k 1 "$COMPILE_TIMEOUT_S" "${ASM_CMD[@]}" 2>&1)
  asm_rc=$?
  meta asm_rc "$asm_rc"
  if [ "$asm_rc" -ne 0 ]; then
    rm -f out.s
    {
      printf '\n[generated assembly unavailable: %s exited with status %s]\n' "${ASM_CMD[0]}" "$asm_rc"
      printf '%s\n' "$asm_log"
    } >> compile.log
  fi
fi

# --- run phase ---------------------------------------------------------------
# stdin is /dev/null: programs see EOF immediately, by design.
start=$(now_ms)
timeout -k 1 "$RUN_TIMEOUT_S" "${RUN_CMD[@]}" < /dev/null > stdout.txt 2> stderr.txt
run_rc=$?
meta run_ms "$(( $(now_ms) - start ))"
meta run_rc "$run_rc"

finish

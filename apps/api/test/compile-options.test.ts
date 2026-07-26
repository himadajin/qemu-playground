import { describe, expect, it } from "vitest";
import {
  InvalidCompileOptionsError,
  parseCompileOptions,
  tokenizeCompileOptions,
} from "../src/compile-options.js";

describe("tokenizeCompileOptions", () => {
  it("splits on runs of whitespace", () => {
    expect(tokenizeCompileOptions("  -O2\t-Wall \n -g ")).toEqual(["-O2", "-Wall", "-g"]);
  });

  it("returns nothing for a blank string", () => {
    expect(tokenizeCompileOptions("   ")).toEqual([]);
  });

  it("keeps quoted whitespace inside a single token", () => {
    expect(tokenizeCompileOptions('-DGREETING="hello world"')).toEqual(["-DGREETING=hello world"]);
    expect(tokenizeCompileOptions("-DA='x y' -DB=z")).toEqual(["-DA=x y", "-DB=z"]);
  });

  it("preserves an empty quoted token", () => {
    expect(tokenizeCompileOptions("-DA= ''")).toEqual(["-DA=", ""]);
  });

  it("honours backslash escapes", () => {
    expect(tokenizeCompileOptions("-DA=a\\ b")).toEqual(["-DA=a b"]);
    expect(tokenizeCompileOptions('-DA="a\\"b"')).toEqual(['-DA=a"b']);
  });

  it("rejects an unterminated quote", () => {
    expect(() => tokenizeCompileOptions("-DA='x")).toThrow(InvalidCompileOptionsError);
  });
});

describe("parseCompileOptions", () => {
  it("treats absent and empty input as no options", () => {
    expect(parseCompileOptions(undefined)).toEqual([]);
    expect(parseCompileOptions("")).toEqual([]);
    expect(parseCompileOptions("   ")).toEqual([]);
  });

  it.each([
    "-O0",
    "-O1",
    "-O2",
    "-O3",
    "-Os",
    "-Og",
    "-g",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-w",
    "-std=c99",
    "-std=gnu17",
    "-fno-stack-protector",
    "-funroll-loops",
    "-march=rv64gc",
    "-mabi=lp64d",
    "-DFOO=1",
    "-UNDEBUG",
    "-static",
    "-nostdlib",
  ])("accepts %s", (option) => {
    expect(parseCompileOptions(option)).toEqual([option]);
  });

  it.each([
    // Redirects the build's output, which the runner owns.
    "-o /tmp/evil",
    "-o",
    // Reads or writes paths outside the single translation unit.
    "-I/etc",
    "-L/lib",
    "-lm",
    "-B/usr/bin",
    "-include /etc/passwd",
    "-isystem/etc",
    "-specs=/tmp/specs",
    "-MF deps.d",
    // Passes arbitrary text straight to another tool.
    "-Wl,-rpath,/tmp",
    "-Wa,--noexecstack",
    "-Wp,-I/etc",
    "-Xlinker",
    // Reads or writes files despite matching an allowed prefix.
    "-fplugin=/tmp/x.so",
    "-fprofile-use=/tmp",
    "-fdump-tree-all",
    "-fstack-usage",
    // Response files and bare operands (extra sources / object files).
    "@argfile",
    "prog2.c",
    "/etc/passwd",
    // Changes the compilation mode the runner depends on.
    "-c",
    "-S",
    "-E",
  ])("rejects %s", (options) => {
    expect(() => parseCompileOptions(options)).toThrow(InvalidCompileOptionsError);
  });

  it("names the offending token in the error message", () => {
    expect(() => parseCompileOptions("-O2 -Wl,-rpath,/tmp -g")).toThrow(/"-Wl,-rpath,\/tmp"/);
  });

  it("rejects an over-long option string", () => {
    expect(() => parseCompileOptions("-DA=1 ".repeat(1000))).toThrow(/too long/);
  });

  it("rejects too many options", () => {
    expect(() => parseCompileOptions("-g ".repeat(65))).toThrow(/too many options/);
  });
});

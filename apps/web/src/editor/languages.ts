import { cpp } from "@codemirror/lang-cpp";
import { StreamLanguage } from "@codemirror/language";
import { gas, gasArm } from "@codemirror/legacy-modes/mode/gas";
import type { Language, TargetId } from "@qemu-playground/shared";

const c = cpp();
const rv64 = StreamLanguage.define(gas);
const aarch64 = StreamLanguage.define({
  ...gasArm,
  token(stream, state) {
    // The legacy ARM mode tracks block comments in tokenize. Adapt only line
    // comments: AArch64 uses // instead of ARM32's @, and # still marks immediates.
    if (!(state as { tokenize: unknown }).tokenize) {
      if (stream.match("//")) {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.eat("@")) return null;
    }
    return gasArm.token(stream, state);
  },
  languageData: {
    ...gasArm.languageData,
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
  },
});

export function editorLanguage(language: Language, target: TargetId) {
  if (language === "c") return c;
  return target === "aarch64" ? aarch64 : rv64;
}

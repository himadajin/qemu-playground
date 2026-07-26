/**
 * The Monaco bundle, imported only from the lazy loader so that the toolbar
 * and page skeleton can render before the editor is downloaded.
 *
 * Only the editor core, a hand-picked set of editing contributions and the C
 * grammar are pulled in. The package's default entry point additionally
 * bundles every other language plus the TypeScript language service (~12 MB
 * of sources), none of which a C/assembly playground can use.
 */
import * as monaco from "monaco-editor/editor/editor.api";

import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/caretOperations/browser/caretOperations";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo";
import "monaco-editor/editor/contrib/dnd/browser/dnd";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/indentation/browser/indentation";
import "monaco-editor/editor/contrib/lineSelection/browser/lineSelection";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/longLinesHelper/browser/longLinesHelper";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/editor/contrib/readOnlyMessage/browser/contribution";
import "monaco-editor/editor/contrib/smartSelect/browser/smartSelect";
import "monaco-editor/editor/contrib/wordHighlighter/browser/wordHighlighter";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import "monaco-editor/editor/contrib/wordPartOperations/browser/wordPartOperations";
import "monaco-editor/features/find/register";
import "monaco-editor/languages/definitions/cpp/register";

import EditorWorker from "monaco-editor/editor/editor.worker?worker";

import { ASM_LANGUAGE_ID, asmLanguage, asmLanguageConfiguration } from "./asmLanguage";

// Only the plain editor worker exists in this bundle; no language service
// worker is ever requested for C or assembly.
self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

monaco.languages.register({ id: ASM_LANGUAGE_ID, extensions: [".s", ".S", ".asm"] });
monaco.languages.setMonarchTokensProvider(ASM_LANGUAGE_ID, asmLanguage);
monaco.languages.setLanguageConfiguration(ASM_LANGUAGE_ID, asmLanguageConfiguration);

export { monaco };
export type MonacoApi = typeof monaco;

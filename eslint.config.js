import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  globalIgnores(["**/dist/**", "**/node_modules/**", ".claude/**", "**/.wrangler/**"]),
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    extends: [reactHooks.configs.flat.recommended],
  },
  eslintConfigPrettier,
]);

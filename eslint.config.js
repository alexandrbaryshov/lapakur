import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // исходники пользователя, служебные папки и производные артефакты не линтуются
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "media-src/**",
      ".autopilot/**",
      ".impeccable/**",
      "lapakur referenses/**",
      "prices/**",
      "dogs-foto-live/**",
      "coverage/**",
      "lapakur-github/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);

import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// По умолчанию jsdom (компоненты); тесты конвейера медиа и бюджета
// переключаются на node докблоком `// @vitest-environment node`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["tests/**/*.test.{ts,tsx}"],
      testTimeout: 180_000,
      hookTimeout: 180_000,
    },
  }),
);

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isPublic } from "../scripts/export-public.mjs";

describe("isPublic — что попадает в публичную копию для GitHub", () => {
  it("сайт, тесты, медиа-исходники и документация — да", () => {
    for (const path of ["index.html", "src/App.tsx", "tests/data.test.ts", "media-src/hero-video.mp4", "DESIGN.md", "docs/adr/0001-shapka-pered-tyurbanom.md", ".github/workflows/pages.yml"]) {
      expect(isPublic(path), path).toBe(true);
    }
  });

  it("из .autopilot — только facts.md сборки (эталон для tests/data.test.ts)", () => {
    expect(isPublic(".autopilot/2026-10-22-lapakur-landing/facts.md")).toBe(true);
    expect(isPublic(".autopilot/2026-10-22-lapakur-landing/manifest.md")).toBe(false);
    expect(isPublic(".autopilot/PROGRESS.md")).toBe(false);
  });

  it("рабочие материалы impeccable и инструкции агента — нет", () => {
    for (const path of [".impeccable/mocks/decision/atelier-line.png", "assets/plates/hero-poster.png", "AGENTS.md", "CLAUDE.md"]) {
      expect(isPublic(path), path).toBe(false);
    }
  });
});

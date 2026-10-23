// @vitest-environment node
import { describe, it, expect } from "vitest";
import { applySiteUrl } from "../scripts/build.mjs";

// Так vite пишет мета в dist/index.html при base "./".
const page = `<html><head>
    <meta property="og:image" content="./media/og-image-1200.jpg" />
    <meta property="og:image:width" content="1200" />
  </head><body></body></html>`;

describe("applySiteUrl — абсолютные адреса для публикации", () => {
  it("og:image абсолютный, canonical и og:url — адрес сайта", () => {
    const out = applySiteUrl(page, "https://example.github.io/lapakur");
    expect(out).toContain('<meta property="og:image" content="https://example.github.io/lapakur/media/og-image-1200.jpg" />');
    expect(out).toContain('<link rel="canonical" href="https://example.github.io/lapakur/" />');
    expect(out).toContain('<meta property="og:url" content="https://example.github.io/lapakur/" />');
    expect(out).toContain('<meta property="og:image:width" content="1200" />');
  });

  it("косая черта в конце адреса не удваивается", () => {
    const out = applySiteUrl(page, "https://lapakur.ru/");
    expect(out).toContain('content="https://lapakur.ru/media/og-image-1200.jpg"');
    expect(out).toContain('href="https://lapakur.ru/"');
  });

  it("без og:image — ошибка, а не тихая страница без картинки", () => {
    expect(() => applySiteUrl("<html><head></head></html>", "https://lapakur.ru")).toThrow(/og:image/);
  });
});

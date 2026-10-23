// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { checkBudget } from "../scripts/budget.mjs";

// Лимиты — из interfaces.md / тикета 01: картинка мобильной ширины ≤ 250 КБ,
// мобильное видео ≤ 1,2 МБ, десктопное ≤ 3 МБ, JS первого экрана (gzip) ≤ 120 КБ;
// критичное первого экрана ≤ 300 КБ (история 32). Размеры десятичные: 1 КБ = 1000 байт.

let dist: string;

function put(rel: string, content: Buffer | string) {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

const noise = (bytes: number) => randomBytes(bytes); // не сжимается gzip
const html = (head: string) =>
  `<!doctype html><html lang="ru"><head>${head}</head><body><div id="root"></div></body></html>`;

function healthyDist() {
  put("index.html", html(`<script type="module" crossorigin src="./assets/index-abc.js"></script>`));
  put("assets/index-abc.js", noise(40_000));
  put("assets/lazy-chunk.js", noise(400_000)); // не на первом экране — не считается
  put("media/hero-poster-480.avif", noise(60_000));
  put("media/hero-poster-1600.jpg", noise(600_000)); // десктопная ширина — без лимита 250 КБ
  put("media/hero-video-mobile.mp4", noise(1_100_000));
  put("media/hero-video-desktop.webm", noise(2_900_000));
}

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), "lapakur-budget-"));
});
afterEach(() => {
  rmSync(dist, { recursive: true, force: true });
});

describe("scripts/budget.mjs", () => {
  it("здоровая сборка проходит", () => {
    healthyDist();
    const result = checkBudget(dist);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("картинка мобильной ширины (≤ 800 px) или без ширины в имени > 250 КБ — нарушение", () => {
    healthyDist();
    put("media/works-bichon-800.jpg", noise(260_000));
    put("assets/texture.png", noise(251_000));
    put("media/works-bichon-1200.jpg", noise(260_000)); // десктоп — можно
    const { ok, violations } = checkBudget(dist);
    expect(ok).toBe(false);
    expect(violations).toHaveLength(2);
    expect(violations.join("\n")).toContain("works-bichon-800.jpg");
    expect(violations.join("\n")).toContain("texture.png");
  });

  it("мобильное видео > 1,2 МБ и десктопное > 3 МБ — нарушения", () => {
    healthyDist();
    put("media/hero-video-mobile.webm", noise(1_300_000));
    put("media/hero-video-desktop.mp4", noise(3_100_000));
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(2);
    expect(violations.join("\n")).toContain("hero-video-mobile.webm");
    expect(violations.join("\n")).toContain("hero-video-desktop.mp4");
  });

  it("JS первого экрана — входной скрипт и modulepreload из index.html — > 120 КБ gzip", () => {
    put(
      "index.html",
      html(
        `<script type="module" crossorigin src="./assets/index-abc.js"></script>` +
          `<link rel="modulepreload" crossorigin href="./assets/vendor-def.js">`,
      ),
    );
    put("assets/index-abc.js", noise(70_000));
    put("assets/vendor-def.js", noise(60_000));
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/JS первого экрана/);
  });

  it("критичное первого экрана (HTML + JS + CSS + preload) > 300 КБ — нарушение", () => {
    put(
      "index.html",
      html(
        `<script type="module" crossorigin src="./assets/index-abc.js"></script>` +
          `<link rel="stylesheet" crossorigin href="./assets/index-abc.css">` +
          `<link rel="preload" as="font" type="font/woff2" crossorigin href="./assets/prata.woff2">`,
      ),
    );
    put("assets/index-abc.js", noise(100_000));
    put("assets/index-abc.css", noise(20_000));
    put("assets/prata.woff2", noise(200_000));
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/[Кк]ритичное/);
  });

  // ── «Критичное» — то, что реально грузит телефон (390 px, DPR 3) на первом экране со шторкой
  // (тикет 05): все шрифты из CSS, ленивые чанки шторки и Motion, текстура шторки и карниз из CSS,
  // кандидат постера, которого выберет телефон, а не самый лёгкий.

  const firstScreenHtml = (extraHead = "", body = "") =>
    `<!doctype html><html lang="ru"><head>` +
    `<script type="module" crossorigin src="./assets/index-abc.js"></script>` +
    `<link rel="stylesheet" crossorigin href="./assets/index-abc.css">${extraHead}</head>` +
    `<body><div id="root">${body}</div></body></html>`;

  it("все файлы шрифтов из CSS входят в критичное, а не только preload", () => {
    put("index.html", firstScreenHtml());
    put("assets/index-abc.js", noise(20_000));
    put(
      "assets/index-abc.css",
      ["a", "b", "c", "d"].map((n) => `@font-face{font-family:F;src:url(./font-${n}.woff2) format("woff2")}`).join(""),
    );
    for (const n of ["a", "b", "c", "d"]) put(`assets/font-${n}.woff2`, noise(75_000));
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/[Кк]ритичное/);
    expect(violations[0]).toContain("font-d.woff2");
  });

  it("ленивые чанки, которые входной скрипт грузит сразу (шторка, Motion), считаются; чанк по действию (Lightbox) — нет", () => {
    put("index.html", firstScreenHtml());
    put("assets/index-abc.css", "body{margin:0}");
    const entry = (refs: string[]) =>
      `const d=[${refs.map((r) => `"./${r}"`).join(",")}];` + noise(20_000).toString("base64");
    put("assets/index-abc.js", entry(["CurtainPanel-x1.js", "CurtainPanel-x1.css", "motionFeatures-y2.js", "Lightbox-z3.js", "Lightbox-z3.css"]));
    put("assets/CurtainPanel-x1.js", `import"./shared-q9.js";` + noise(10).toString("hex"));
    put("assets/CurtainPanel-x1.css", ".c{color:red}");
    put("assets/shared-q9.js", noise(150_000)); // общий чанк шторки и Motion — тоже первый экран
    put("assets/motionFeatures-y2.js", noise(150_000));
    put("assets/Lightbox-z3.js", noise(400_000)); // открывается по нажатию — не первый экран
    put("assets/Lightbox-z3.css", noise(100_000));
    const { violations, report } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    const text = violations[0];
    expect(text).toContain("shared-q9.js");
    expect(text).toContain("motionFeatures-y2.js");
    expect(text).not.toContain("Lightbox");
    expect(report.join("\n")).toMatch(/ленив/);

    // без больших ленивых чанков — в норме
    put("assets/shared-q9.js", noise(1_000));
    put("assets/motionFeatures-y2.js", noise(1_000));
    expect(checkBudget(dist).violations).toEqual([]);
  });

  it("текстура шторки и карниз из CSS — по кандидату телефона (AVIF из image-set), десктопные @media не считаются", () => {
    put("index.html", firstScreenHtml());
    put("assets/index-abc.js", noise(70_000));
    put(
      "assets/index-abc.css",
      `html[data-curtain=pending] body:before{background-image:url(../media/curtain-800.webp);` +
        `background-image:image-set(url(../media/curtain-800.avif) type("image/avif"),url(../media/curtain-800.webp) type("image/webp"))}` +
        `@media(min-width:900px){html[data-curtain=pending] body:before{background-image:url(../media/curtain-1600.avif)}}`,
    );
    put("media/curtain-800.avif", noise(240_000));
    put("media/curtain-800.webp", noise(10_000)); // фолбэк перекрыт image-set — телефон его не берёт
    put("media/curtain-1600.avif", noise(500_000)); // десктоп — не первый экран телефона
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/[Кк]ритичное/);
    expect(violations[0]).toContain("curtain-800.avif");
    expect(violations[0]).not.toContain("curtain-1600");
    expect(violations[0]).not.toContain("curtain-800.webp");
  });

  it("постер с fetchpriority=high считается по кандидату, которого выберет телефон 390 px при DPR 3", () => {
    const picture =
      `<picture><source type="image/avif" srcset="./media/p-480.avif 480w, ./media/p-800.avif 800w, ./media/p-1600.avif 1600w" ` +
      `sizes="(max-width: 899px) 100vw, 37vw">` +
      `<img src="./media/p-480.jpg" srcset="./media/p-480.jpg 480w" sizes="(max-width: 899px) 100vw, 37vw" fetchpriority="high" loading="eager"></picture>`;
    put("index.html", firstScreenHtml("", picture));
    put("assets/index-abc.js", noise(20_000));
    put("assets/index-abc.css", "body{margin:0}");
    put("media/p-480.avif", noise(5_000));
    put("media/p-800.avif", noise(10_000));
    put("media/p-1600.avif", noise(290_000)); // 390 × 3 = 1170 px — телефон берёт 1600w
    put("media/p-480.jpg", noise(5_000));
    const { violations } = checkBudget(dist);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("p-1600.avif");
  });

  it("CLI: нарушение — ненулевой код выхода, норма — ноль", () => {
    healthyDist();
    const okRun = spawnSync(process.execPath, ["scripts/budget.mjs", dist], { encoding: "utf8" });
    expect(okRun.status).toBe(0);
    put("media/hero-video-mobile.mp4", noise(1_300_000));
    const badRun = spawnSync(process.execPath, ["scripts/budget.mjs", dist], { encoding: "utf8" });
    expect(badRun.status).not.toBe(0);
    expect(badRun.stdout + badRun.stderr).toContain("hero-video-mobile.mp4");
  });
});

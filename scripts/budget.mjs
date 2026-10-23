// Бюджет размеров собранной страницы (dist/). Запуск: `node scripts/budget.mjs [dist]`.
// Нарушение — список в stderr и код выхода 1; входит в `npm run check`.
//
// Правила (interfaces.md, тикет 01, история 32 спецификации), размеры десятичные (1 КБ = 1000 байт):
//  • картинка мобильной раздачи ≤ 250 КБ. Мобильная — ширина в имени файла ≤ 800 px
//    (`<ключ>-<ширина>.<ext>`, как пишет scripts/media.mjs) или ширины в имени нет вовсе
//    (такую картинку получают все, включая телефоны);
//  • видео `*-mobile.*` ≤ 1,2 МБ, `*-desktop.*` ≤ 3 МБ, видео без пометки — по мобильному лимиту;
//  • JS первого экрана — входной `<script type="module">` и `<link rel="modulepreload">`
//    из index.html — ≤ 120 КБ в gzip; ленивые чанки не считаются;
//  • критичное первого экрана — всё, что грузит телефон (FIRST_SCREEN: 390 px, DPR 3) на первом
//    экране со шторкой, ≤ 300 КБ (текст — в gzip): HTML; входной JS и modulepreload; CSS из index.html;
//    `<link rel="preload">`; ленивые чанки, на которые ссылается входной скрипт (шторка, Motion —
//    они грузятся сразу после гидрации), с их CSS — кроме чанков по действию и после load (ON_DEMAND_CHUNKS);
//    все шрифты из этого CSS (текст страницы целиком в DOM, браузер качает их сразу);
//    картинки из CSS для телефона (текстура шторки, карниз, маска логотипа): @media (min-width > 390)
//    отброшены, в image-set — первый (AVIF) кандидат, повторное свойство в правиле перекрывает прежнее;
//    `<img fetchpriority="high">` и картинки шапки — тот кандидат srcset (AVIF-источник <picture>),
//    которого выберет телефон по `sizes`.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const LIMITS = {
  mobileImageBytes: 250_000,
  mobileVideoBytes: 1_200_000,
  desktopVideoBytes: 3_000_000,
  firstScreenJsGzipBytes: 120_000,
  criticalBytes: 300_000,
};

/** Картинки шире этого — десктопные кандидаты srcset, лимит 250 КБ на них не распространяется. */
export const MOBILE_MAX_WIDTH = 800;

/** Телефон, для которого считается критичное первого экрана. */
export const FIRST_SCREEN = { width: 390, dpr: 3 };

/**
 * Ленивые чанки не первого экрана: просмотр фото грузится по нажатию (Works), сквозная нить —
 * после события load (InkLine). Остальные ленивые чанки входного скрипта считаются первым экраном.
 */
export const ON_DEMAND_CHUNKS = [/^Lightbox-/, /^InkLine\.thread-/];

const IMAGE_EXT = new Set([".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const TEXT_EXT = new Set([".html", ".js", ".mjs", ".css", ".svg", ".json", ".txt"]);

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} КБ`;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Ширина из имени `<ключ>-<ширина>.<ext>` или null. */
export function widthFromName(file) {
  const m = basename(file, extname(file)).match(/-(\d{2,4})w?$/);
  return m ? Number(m[1]) : null;
}

function parseAttrs(source) {
  const attrs = {};
  for (const m of source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => parseAttrs(m[1]));
}

function localPath(distDir, url) {
  if (!url || /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:")) return null;
  const clean = url.split(/[?#]/)[0].replace(/^\.?\//, "");
  return join(distDir, decodeURIComponent(clean));
}

function transferSize(file) {
  const buf = readFileSync(file);
  return TEXT_EXT.has(extname(file).toLowerCase()) ? gzipSync(buf, { level: 9 }).length : buf.length;
}

// ─────────────── первый экран телефона ───────────────

const FONT_EXT = new Set([".woff2", ".woff", ".ttf", ".otf"]);
const CSS_IMAGE_EXT = new Set([".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg"]);

/** Путь файла, на который ссылается `url` из файла `from` (CSS, JS-чанк); внешние и data: — null. */
function resolveFrom(from, url) {
  if (!url || /^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:")) return null;
  return resolve(dirname(from), decodeURIComponent(url.split(/[?#]/)[0]));
}

/** Ширина слота по атрибуту `sizes` для экрана `width` × `dpr` (max-/min-width, min-resolution). */
export function slotWidth(sizes, width, dpr) {
  for (const part of (sizes ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.*\))\s+(\S+)$/.exec(part);
    const [cond, len] = m ? [m[1], m[2]] : ["", part];
    const ok = (cond.match(/\(([^)]+)\)/g) ?? []).every((c) => {
      const [, feature, value] = /\(\s*([\w-]+)\s*:\s*([\d.]+)/.exec(c) ?? [];
      const v = Number(value);
      if (feature === "max-width") return width <= v;
      if (feature === "min-width") return width >= v;
      if (feature === "min-resolution") return dpr >= v;
      if (feature === "max-resolution") return dpr <= v;
      return false;
    });
    if (!ok) continue;
    if (len.endsWith("vw")) return (Number(len.slice(0, -2)) / 100) * width;
    if (len.endsWith("px")) return Number(len.slice(0, -2));
    return width;
  }
  return width;
}

/** Кандидат srcset, которого выберет экран: наименьший `w` не уже слота × DPR, иначе самый широкий. */
function chosenCandidate(distDir, srcset, sizes, screen) {
  const need = slotWidth(sizes, screen.width, screen.dpr) * screen.dpr;
  const list = srcset
    .split(",")
    .map((c) => c.trim().split(/\s+/))
    .filter(([url]) => url)
    .map(([url, d]) => ({ url, w: Number(/^(\d+)w$/.exec(d ?? "")?.[1] ?? 0) }))
    .sort((a, b) => a.w - b.w);
  if (list.length === 0) return null;
  const pick = list.find((c) => c.w >= need) ?? list[list.length - 1];
  return localPath(distDir, pick.url);
}

/** Картинки `<picture>`/`<img>` фрагмента HTML, как их выберет экран (AVIF-источник первым). */
function pictureFiles(distDir, fragment, screen, filter = () => true) {
  const files = [];
  const pictures = [...fragment.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi)].map((m) => m[1]);
  const loose = fragment.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "");
  for (const inner of pictures) {
    const img = tags(inner, "img")[0];
    if (!img || !filter(img)) continue;
    const avif = tags(inner, "source").find((s) => (s.type ?? "").toLowerCase() === "image/avif" && s.srcset);
    const source = avif ?? img;
    const file = source.srcset ? chosenCandidate(distDir, source.srcset, source.sizes ?? img.sizes, screen) : localPath(distDir, img.src);
    if (file) files.push(file);
  }
  for (const img of tags(loose, "img")) {
    if (!filter(img)) continue;
    const file = img.srcset ? chosenCandidate(distDir, img.srcset, img.sizes, screen) : localPath(distDir, img.src);
    if (file) files.push(file);
  }
  return files;
}

/** Верхнеуровневые блоки CSS: { prelude, body } — «selector{…}», «@media(…){…}» и т. п. */
function cssBlocks(css) {
  const blocks = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    for (; j < css.length && depth > 0; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
    }
    blocks.push({ prelude: css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return blocks;
}

/** Применяется ли `@media` к телефону (ширина): min-/max-width; прочие условия — да. */
function mediaApplies(prelude, width) {
  return (prelude.match(/\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)/g) ?? []).every((c) => {
    const [, kind, value] = /(min|max)-width\s*:\s*([\d.]+)/.exec(c);
    return kind === "min" ? width >= Number(value) : width <= Number(value);
  });
}

/** Делит строку по разделителю верхнего уровня (вне скобок и кавычек). */
function splitTop(text, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === sep && depth === 0) {
      out.push(text.slice(start, k));
      start = k + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

const urlsIn = (text) => [...text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);

/** URL картинок, которые телефон берёт из CSS: в image-set — первый кандидат; позднее свойство перекрывает раннее. */
function cssImageUrls(css, width) {
  const urls = [];
  for (const { prelude, body } of cssBlocks(css)) {
    if (prelude.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase();
      if (name === "media" && !mediaApplies(prelude, width)) continue;
      if (name === "media" || name === "supports" || name === "layer" || name === "container") urls.push(...cssImageUrls(body, width));
      continue; // @font-face (шрифты считаются отдельно), @keyframes
    }
    const props = new Map();
    for (const decl of splitTop(body, ";")) {
      const colon = decl.indexOf(":");
      if (colon > 0) props.set(decl.slice(0, colon).trim().toLowerCase(), decl.slice(colon + 1));
    }
    for (const value of props.values()) {
      if (!value.includes("url(")) continue;
      for (const layer of splitTop(value, ",")) {
        const set = /image-set\(([\s\S]*)\)/i.exec(layer);
        const found = urlsIn(set ? set[1] : layer);
        urls.push(...(set ? found.slice(0, 1) : found));
      }
    }
  }
  return urls;
}

/** JS- и CSS-чанки, на которые входные скрипты ссылаются как "./имя.js|css" — транзитивно, без чанков по действию. */
function lazyChunks(entryFiles) {
  const seen = new Set(entryFiles);
  const queue = [...entryFiles];
  const found = [];
  while (queue.length) {
    const file = queue.shift();
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g)) {
      if (ON_DEMAND_CHUNKS.some((re) => re.test(m[1]))) continue;
      const ref = join(dirname(file), m[1]);
      if (seen.has(ref) || !existsSync(ref)) continue;
      seen.add(ref);
      found.push(ref);
      if (ref.endsWith(".js")) queue.push(ref);
    }
  }
  return found;
}

export function checkBudget(distDir = "dist", limits = LIMITS) {
  const violations = [];
  const report = [];
  const rel = (f) => relative(distDir, f).replace(/\\/g, "/");

  if (!existsSync(distDir)) {
    return { ok: false, violations: [`нет папки сборки ${distDir} — сначала npm run build`], report };
  }

  // ── медиа ──
  for (const file of walk(distDir)) {
    const ext = extname(file).toLowerCase();
    const size = statSync(file).size;
    if (IMAGE_EXT.has(ext)) {
      const width = widthFromName(file);
      if (width !== null && width > MOBILE_MAX_WIDTH) continue;
      if (size > limits.mobileImageBytes) {
        violations.push(
          `картинка мобильной раздачи ${rel(file)}: ${kb(size)} > ${kb(limits.mobileImageBytes)}` +
            (width === null ? " (ширины в имени нет — её получают и телефоны)" : ` (ширина ${width})`),
        );
      }
    } else if (VIDEO_EXT.has(ext)) {
      const desktop = /-desktop$/i.test(basename(file, ext));
      const limit = desktop ? limits.desktopVideoBytes : limits.mobileVideoBytes;
      report.push(`видео ${rel(file)}: ${kb(size)} (лимит ${kb(limit)})`);
      if (size > limit) {
        violations.push(`${desktop ? "десктопное" : "мобильное"} видео ${rel(file)}: ${kb(size)} > ${kb(limit)}`);
      }
    }
  }

  // ── первый экран по index.html ──
  const indexFile = join(distDir, "index.html");
  if (existsSync(indexFile)) {
    const html = readFileSync(indexFile, "utf8");
    const jsFiles = new Set();
    const criticalFiles = new Set([indexFile]);
    const missing = [];
    const add = (set, url) => {
      const file = localPath(distDir, url);
      if (!file) return;
      if (existsSync(file)) set.add(file);
      else missing.push(url);
    };

    const cssFiles = new Set();
    for (const a of tags(html, "script")) if (a.type === "module" && a.src) add(jsFiles, a.src);
    for (const a of tags(html, "link")) {
      const relAttr = (a.rel ?? "").toLowerCase().split(/\s+/);
      if (relAttr.includes("modulepreload")) add(jsFiles, a.href);
      if (relAttr.includes("stylesheet")) add(cssFiles, a.href);
      if (relAttr.includes("preload")) {
        if (a.href) add(criticalFiles, a.href);
        else if (a.imagesrcset) {
          const f = chosenCandidate(distDir, a.imagesrcset, a.imagesizes, FIRST_SCREEN);
          if (f && existsSync(f)) criticalFiles.add(f);
        }
      }
    }

    for (const url of missing) violations.push(`index.html ссылается на отсутствующий файл ${url}`);

    const jsGzip = [...jsFiles].reduce((sum, f) => sum + gzipSync(readFileSync(f), { level: 9 }).length, 0);
    report.push(`JS первого экрана: ${kb(jsGzip)} gzip (лимит ${kb(limits.firstScreenJsGzipBytes)})`);
    if (jsGzip > limits.firstScreenJsGzipBytes) {
      violations.push(
        `JS первого экрана ${kb(jsGzip)} gzip > ${kb(limits.firstScreenJsGzipBytes)}: ${[...jsFiles].map(rel).join(", ")}`,
      );
    }

    // ленивые чанки, которые входной скрипт подтягивает сразу (шторка, Motion, линия), и их CSS
    const lazy = lazyChunks([...jsFiles]);
    for (const f of lazy) (f.endsWith(".css") ? cssFiles : criticalFiles).add(f);

    // шрифты и картинки, на которые ссылается CSS первого экрана (для телефона)
    const fonts = new Set();
    const cssImages = new Set();
    for (const css of cssFiles) {
      const text = readFileSync(css, "utf8");
      for (const url of urlsIn(text)) {
        const f = resolveFrom(css, url);
        if (f && FONT_EXT.has(extname(f).toLowerCase()) && existsSync(f)) fonts.add(f);
      }
      for (const url of cssImageUrls(text, FIRST_SCREEN.width)) {
        const f = resolveFrom(css, url);
        if (f && CSS_IMAGE_EXT.has(extname(f).toLowerCase()) && existsSync(f)) cssImages.add(f);
      }
    }

    // картинки разметки: постер (fetchpriority=high) и картинки шапки — как их выберет телефон
    const htmlImages = new Set(
      pictureFiles(distDir, html, FIRST_SCREEN, (img) => (img.fetchpriority ?? "").toLowerCase() === "high"),
    );
    const header = /<header\b[\s\S]*?<\/header>/i.exec(html)?.[0] ?? "";
    for (const f of pictureFiles(distDir, header, FIRST_SCREEN)) htmlImages.add(f);
    for (const f of htmlImages) if (!existsSync(f)) htmlImages.delete(f);

    for (const f of [...jsFiles, ...cssFiles, ...fonts, ...cssImages, ...htmlImages]) criticalFiles.add(f);
    const sum = (files) => [...files].reduce((s, f) => s + transferSize(f), 0);
    const critical = sum(criticalFiles);
    const lazyJs = lazy.filter((f) => f.endsWith(".js"));
    report.push(
      `критичное первого экрана (телефон ${FIRST_SCREEN.width} px, DPR ${FIRST_SCREEN.dpr}, со шторкой): ${kb(critical)} ` +
        `(лимит ${kb(limits.criticalBytes)}) — HTML ${kb(transferSize(indexFile))}, JS ${kb(sum(jsFiles))} + ` +
        `ленивые чанки ${kb(sum(lazyJs))} (${lazyJs.map((f) => basename(f)).join(", ") || "нет"}), ` +
        `CSS ${kb(sum(cssFiles))}, шрифты ${kb(sum(fonts))} (${fonts.size}), картинки CSS ${kb(sum(cssImages))} ` +
        `(${[...cssImages].map((f) => basename(f)).join(", ") || "нет"}), картинки разметки ${kb(sum(htmlImages))} ` +
        `(${[...htmlImages].map((f) => basename(f)).join(", ") || "нет"})`,
    );
    if (critical > limits.criticalBytes) {
      violations.push(
        `критичное первого экрана ${kb(critical)} > ${kb(limits.criticalBytes)}: ${[...criticalFiles].map(rel).join(", ")}`,
      );
    }
  } else {
    violations.push(`нет ${rel(indexFile)}`);
  }

  return { ok: violations.length === 0, violations, report };
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const distDir = resolve(process.argv[2] ?? "dist");
  const { ok, violations, report } = checkBudget(distDir);
  for (const line of report) console.log(`  ${line}`);
  if (ok) {
    console.log("Бюджет размеров соблюдён.");
  } else {
    console.error("Бюджет размеров нарушен:");
    for (const v of violations) console.error(`  ✗ ${v}`);
    process.exitCode = 1;
  }
}

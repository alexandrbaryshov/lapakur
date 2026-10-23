// Сборка страницы: `npm run build` (`node scripts/build.mjs`).
// 1) vite build → dist/ (base "./", открывается из dist/index.html);
// 2) SSR-сборка src/App.tsx и пререндер: готовая разметка App вставляется в dist/index.html
//    на место <!--app-html-->. Первый экран рисуется до загрузки JS (медленная сеть, R36),
//    без JS страница читается (R41i); в браузере main.tsx гидрирует эту разметку.
// Правило для компонентов: при рендере не трогать window/document/sessionStorage — только в эффектах.
// 3) Если задан SITE_URL (в GitHub Actions его даёт actions/configure-pages), og:image становится
//    абсолютным и добавляются canonical и og:url — соцсети и поисковики относительных адресов не берут.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARKER = "<!--app-html-->";

/** Абсолютные og:image, og:url и canonical для страницы по адресу `siteUrl` (с косой чертой в конце или без). */
export function applySiteUrl(page, siteUrl) {
  const base = siteUrl.replace(/\/*$/, "/");
  const image = /(<meta property="og:image" content=")(?:\.\/|\/)?/;
  if (!image.test(page)) throw new Error("В dist/index.html нет og:image");
  return page
    .replace(image, `$1${base}`)
    .replace("</head>", `  <link rel="canonical" href="${base}" />\n    <meta property="og:url" content="${base}" />\n  </head>`);
}

export async function buildSite({ root = ROOT, siteUrl = process.env.SITE_URL } = {}) {
  const configFile = join(root, "vite.config.ts");
  await build({ root, configFile });

  const ssrOut = join(root, "node_modules", ".cache", "lapakur-ssr");
  await build({
    root,
    configFile,
    logLevel: "warn",
    build: {
      ssr: "src/App.tsx",
      outDir: ssrOut,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "app.js" } },
    },
  });

  const { default: App } = await import(`${pathToFileURL(join(ssrOut, "app.js")).href}?v=${Date.now()}`);
  const { createElement } = await import("react");
  const { renderToString } = await import("react-dom/server");
  const html = renderToString(createElement(App));
  if (!html.trim()) throw new Error("Пререндер App вернул пустую разметку");

  const indexFile = join(root, "dist", "index.html");
  const page = readFileSync(indexFile, "utf8");
  if (!page.includes(MARKER)) throw new Error(`В dist/index.html нет метки ${MARKER} внутри #root`);
  const rendered = page.replace(MARKER, html);
  writeFileSync(indexFile, siteUrl ? applySiteUrl(rendered, siteUrl) : rendered);
  console.log(`Пререндер: ${(Buffer.byteLength(html) / 1000).toFixed(1)} КБ разметки App в dist/index.html`);
  if (siteUrl) console.log(`Адрес сайта: ${siteUrl}`);
}

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isCli) await buildSite();

// Скриншоты собранной страницы: `npm run shoot`.
// Собирает страницу (scripts/build.mjs), поднимает `vite preview`, снимает headless Chrome через CDP
// (встроенный WebSocket Node 24, без зависимостей) и пишет в .impeccable/review/:
//   desktop.png  — 1440×900, вся страница, шторка открыта
//   mobile.png   — 390×844, вся страница, шторка открыта
//   desktop-first-closed.png / desktop-first-open.png — первый экран до и после шторки
//   mobile-first-closed.png  / mobile-first-open.png
// «Открыта» = адрес с хэшем #top: по спецификации (R09.2) при хэше шторка не показывается.
// Каждый снимок — в новой вкладке, значит sessionStorage чистый и шторка видна в «closed».
//
// Флаги:
//   --no-build             не пересобирать dist/
//   --out-dir <папка>      куда писать набор по умолчанию (по умолчанию .impeccable/review)
//   --wait <мс>            пауза перед снимком (по умолчанию 800)
//   --headed               видимое окно Chrome вместо headless (если карта в headless в «ограниченном режиме»)
//   Один свой снимок вместо набора:
//   --viewport 2400x1792 --mode first|full --state open|closed --out <файл.png> [--mobile]
//   --network              вместо снимков — сетевая картина первого экрана телефона (390×844, DPR 3,
//                          шторка закрыта) на «медленном 4G» (CDP Network.emulateNetworkConditions):
//                          когда отрисован первый экран, когда пошло видео, что запрошено до прокрутки.
//                          Отчёт — .impeccable/review/network-slow4g.json; нарушение — код выхода 1.
//
// Перед снимком страница «успокаивается»: шрифты загружены, сквозная нить (рисуется после load)
// построена; для снимка всей страницы — прокрутка до низа и обратно (ленивые картинки, нить дорисована)
// и ожидание карты Яндекса ([data-map="ready"]; нужна сеть).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { buildSite } from "./build.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const GPU_FLAGS = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
/**
 * --headed: видимое окно Chrome вместо headless (тот же CDP). Нужно, если сервис в headless
 * отвечает «ограниченным режимом» (так бывает с виджетом Яндекс Карт).
 */
const chromeFlags = (headed) =>
  headed ? [...GPU_FLAGS, "--window-position=0,0", "--window-size=1500,1000"] : ["--headless=new", ...GPU_FLAGS];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function args() {
  const argv = process.argv.slice(2);
  const get = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    build: !argv.includes("--no-build"),
    outDir: resolve(ROOT, get("--out-dir") ?? ".impeccable/review"),
    wait: Number(get("--wait") ?? 800),
    viewport: get("--viewport"),
    mode: get("--mode") ?? "first",
    state: get("--state") ?? "open",
    out: get("--out"),
    mobile: argv.includes("--mobile"),
    network: argv.includes("--network"),
    headed: argv.includes("--headed"),
  };
}

// ─────────────── Chrome + CDP ───────────────

async function launchChrome({ headed = false } = {}) {
  if (!existsSync(CHROME)) throw new Error(`Нет Chrome: ${CHROME} (задайте CHROME_PATH)`);
  const profile = mkdtempSync(join(tmpdir(), "lapakur-chrome-"));
  const proc = spawn(
    CHROME,
    [...chromeFlags(headed), "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run",
     "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "about:blank"],
    { stdio: "ignore", windowsHide: true },
  );
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 150 && !existsSync(portFile); i++) await sleep(100);
  if (!existsSync(portFile)) throw new Error("Chrome не открыл порт отладки");
  let port;
  for (let i = 0; i < 20 && !port; i++) {
    port = Number(readFileSync(portFile, "utf8").split("\n")[0]) || undefined;
    if (!port) await sleep(100);
  }
  return {
    port,
    async close() {
      proc.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
}

class Cdp {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, fail) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", fail, { once: true });
    });
    return new Cdp(ws);
  }
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) fail(new Error(`${msg.error.message} (${msg.error.code})`));
        else ok(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }
  waitFor(method, timeout = 30_000) {
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`нет события ${method} за ${timeout} мс`)), timeout);
      const fn = (params) => {
        clearTimeout(timer);
        this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn));
        ok(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
    });
  }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.text);
    return result.value;
  }
  close() {
    this.ws.close();
  }
}

const SCROLL_THROUGH = `(async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = Math.max(200, innerHeight * 0.8);
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await pause(120); }
  scrollTo(0, document.documentElement.scrollHeight); await pause(300);
  scrollTo(0, 0); await pause(300);
  return true;
})()`;

/**
 * Снимок — с успокоенным движением (impeccable: элемент, спрятанный таймингом анимации, читается как
 * пропавший): появления секций идут по прокрутке (view-timeline), на снимке всей страницы — в конечном виде.
 */
const SETTLE_CSS = `(() => {
  const style = document.createElement("style");
  style.dataset.shoot = "settle";
  style.textContent = "*,*::before,*::after{animation:none!important;animation-timeline:auto!important}";
  document.head.append(style);
  return true;
})()`;

/**
 * Петля обложки на снимке — на первом кадре (он же постер макета): иначе каждый снимок ловит
 * случайный кадр видео, и сверка с макетом (comp-diff) скачет на ±1 %. Ждём, пока видео
 * подключится (после load) и встанет на кадр 0; без видео (reduced-motion, Save-Data) — сразу дальше.
 */
const FREEZE_VIDEO = `(async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  let video = null;
  for (let i = 0; i < 30 && !(video = document.querySelector("video")); i++) await pause(100);
  if (!video) return "нет видео";
  for (let i = 0; i < 50 && video.readyState < 2; i++) await pause(100);
  video.pause();
  video.currentTime = 0;
  await new Promise((r) => (video.seeking ? video.addEventListener("seeked", r, { once: true }) : r()));
  await pause(800); // видео проявляется поверх постера (transition)
  return "кадр 0";
})()`;

/**
 * Карта Яндекса на снимке всей страницы: подвести визит к экрану (виджет грузится только рядом
 * с экраном, а ленивый iframe — только в поле зрения), дождаться [data-map="ready"] (или "failed" —
 * сеть не пустила), дать iframe проявиться и вернуться наверх. Возвращает итоговое состояние карты.
 */
const MAP_READY = `(async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const map = document.querySelector("[data-map]");
  if (!map) return "нет карты";
  map.scrollIntoView({ block: "center" });
  let state = map.getAttribute("data-map");
  for (let i = 0; i < 400 && state !== "ready" && state !== "failed"; i++) {
    await pause(100);
    state = map.getAttribute("data-map");
  }
  if (state === "ready") await pause(2500); // проявление iframe и плитки карты
  scrollTo(0, 0);
  await pause(300);
  return state;
})()`;

/** Ждать сквозную нить (появляется после load); без неё через 5 с — дальше как есть. */
const INK_READY = `(async () => {
  for (let i = 0; i < 50; i++) {
    if (document.querySelector('[data-region="ink-thread"] path')) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
})()`;

async function shot(port, baseUrl, { width, height, mobile, mode, state, out, wait }) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const problems = [];
  const onConsole = (p) => {
    if (p.type === "error" || p.type === "assert") problems.push(p.args.map((a) => a.value ?? a.description ?? "").join(" "));
  };
  const onException = (p) => problems.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text);
  cdp.listeners.set("Runtime.consoleAPICalled", [onConsole]);
  cdp.listeners.set("Runtime.exceptionThrown", [onException]);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    if (mobile) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const loaded = cdp.waitFor("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: state === "open" ? `${baseUrl}#top` : baseUrl });
    await loaded;
    await cdp.evaluate("document.fonts.ready.then(() => true)");
    if (state === "open") await cdp.evaluate(INK_READY);
    await cdp.evaluate(SETTLE_CSS);
    if (state === "open") await cdp.evaluate(FREEZE_VIDEO);
    if (mode === "full") {
      await cdp.evaluate(SCROLL_THROUGH);
      const map = await cdp.evaluate(MAP_READY);
      console.log(`    карта: ${map}`);
      await sleep(900); // пружина нити дотягивает до конца
    }
    await sleep(wait);
    const params = { format: "png" };
    if (mode === "full") {
      // Окно — во всю высоту страницы: чужой iframe (карта Яндекса) Chrome рисует только в поле
      // зрения, а captureBeyondViewport снимает на его месте пустоту.
      const contentHeight = async () => Math.ceil((await cdp.send("Page.getLayoutMetrics")).cssContentSize.height);
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: await contentHeight(), deviceScaleFactor: 1, mobile });
      await sleep(2000);
      params.clip = { x: 0, y: 0, width, height: await contentHeight(), scale: 1 };
    }
    const { data } = await cdp.send("Page.captureScreenshot", params);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`  ${out} — ${width}×${params.clip?.height ?? height}`);
    for (const p of problems) console.warn(`    ! ошибка в консоли страницы: ${p.split("\n")[0].slice(0, 300)}`);
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

// ─────────────── сеть первого экрана на «медленном 4G» ───────────────

/** Пресет DevTools «Slow 4G»: задержка 562,5 мс, 1,44 Мбит/с вниз, 675 кбит/с вверх. */
const SLOW_4G = { offline: false, latency: 562.5, downloadThroughput: 180_000, uploadThroughput: 84_375 };

/** Что страница сама знает о первом экране: отрисовка, картинки и их место относительно экрана. */
const PAGE_FACTS = `(async () => {
  const lcp = await new Promise((resolve) => {
    let last = 0;
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) last = e.startTime; })
        .observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    setTimeout(() => resolve(last), 300);
  });
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, e.startTime]));
  const images = [...document.images].map((img) => {
    const r = img.getBoundingClientRect();
    return { src: img.currentSrc, top: r.top + scrollY, loading: img.loading };
  });
  return { fcp: paint["first-contentful-paint"] ?? null, lcp, viewport: innerHeight, scrollY, images,
           curtain: !!document.querySelector('[role="dialog"]'), iframes: document.querySelectorAll("iframe").length };
})()`;

async function networkCheck(port, baseUrl, outFile) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const requests = new Map();
  let loadAt = null;
  let t0 = null;
  cdp.listeners.set("Network.requestWillBeSent", [
    (p) => {
      if (t0 === null) t0 = p.timestamp;
      requests.set(p.requestId, { url: p.request.url, type: p.type, start: p.timestamp, end: null, bytes: 0 });
    },
  ]);
  cdp.listeners.set("Network.loadingFinished", [
    (p) => {
      const r = requests.get(p.requestId);
      if (r) Object.assign(r, { end: p.timestamp, bytes: p.encodedDataLength });
    },
  ]);
  cdp.listeners.set("Page.loadEventFired", [(p) => (loadAt = p.timestamp)]);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { ...SLOW_4G, connectionType: "cellular4g" });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Page.navigate", { url: baseUrl });
    // ждём load и тишину в сети (видео тоже), не дольше 60 с; посетитель не листает
    const deadline = Date.now() + 60_000;
    let quietSince = Date.now();
    let seen = 0;
    while (Date.now() < deadline) {
      await sleep(250);
      const busy = [...requests.values()].some((r) => r.end === null);
      if (requests.size !== seen || busy) {
        seen = requests.size;
        quietSince = Date.now();
      }
      if (loadAt !== null && Date.now() - quietSince > 3000) break;
    }
    const facts = await cdp.evaluate(PAGE_FACTS);

    const ms = (t) => (t === null || t0 === null ? null : Math.round((t - t0) * 1000));
    const list = [...requests.values()].map((r) => ({ ...r, start: ms(r.start), end: ms(r.end) })).sort((a, b) => a.start - b.start);
    const local = (url) => url.startsWith(baseUrl.replace(/\/$/, ""));
    const path = (url) => new URL(url).pathname.replace(/^\//, "");
    const video = list.find((r) => /hero-video/.test(r.url));
    // ниже первого экрана — файл, который не нужен ни одной картинке первого экрана (одна и та же
    // собака у телефона стоит и в шапке, и в визите)
    const above = new Set(facts.images.filter((i) => i.top < facts.viewport).map((i) => i.src));
    const below = facts.images.filter((i) => i.top >= facts.viewport && !above.has(i.src)).map((i) => i.src);
    const imageRequests = list.filter((r) => local(r.url) && /\.(avif|webp|jpe?g|png|svg)(\?|$)/i.test(r.url));
    const belowRequested = imageRequests.filter((r) => below.includes(r.url)).map((r) => path(r.url));
    const external = list.filter((r) => !local(r.url) && !r.url.startsWith("data:")).map((r) => r.url);
    const beforeVideo = list.filter((r) => r.end !== null && (!video || r.end <= video.start));
    const report = {
      network: "Slow 4G (DevTools): 562,5 мс, 1,44 Мбит/с",
      screen: "390×844, DPR 3, шторка закрыта, без прокрутки",
      fcpMs: facts.fcp === null ? null : Math.round(facts.fcp),
      lcpMs: Math.round(facts.lcp),
      loadMs: ms(loadAt),
      videoStartMs: video ? video.start : null,
      firstScreenBeforeVideo: video ? facts.fcp !== null && facts.fcp < video.start : true,
      bytesBeforeVideo: beforeVideo.reduce((s, r) => s + r.bytes, 0),
      imagesBelowFirstScreenRequested: belowRequested,
      externalRequests: external,
      mapIframes: facts.iframes,
      curtainShown: facts.curtain,
      requests: list
        .filter((r) => !r.url.startsWith("data:"))
        .map((r) => ({ path: local(r.url) ? path(r.url) : r.url, start: r.start, end: r.end, kb: +(r.bytes / 1000).toFixed(1) })),
    };
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

    const problems = [];
    if (!report.firstScreenBeforeVideo) problems.push(`видео начало грузиться (${report.videoStartMs} мс) раньше отрисовки первого экрана (${report.fcpMs} мс)`);
    if (belowRequested.length) problems.push(`до прокрутки запрошены картинки ниже первого экрана: ${belowRequested.join(", ")}`);
    if (report.mapIframes || external.some((u) => /yandex/.test(u))) problems.push("до прокрутки запрошена карта");
    console.log(`  сеть «медленный 4G» → ${outFile}`);
    console.log(`    первый экран (FCP) ${report.fcpMs} мс, LCP ${report.lcpMs} мс, load ${report.loadMs} мс, видео с ${report.videoStartMs ?? "—"} мс`);
    console.log(`    до видео загружено ${(report.bytesBeforeVideo / 1000).toFixed(1)} КБ; шторка ${report.curtainShown ? "на месте" : "не показана"}`);
    for (const p of problems) console.warn(`    ✗ ${p}`);
    if (problems.length) process.exitCode = 1;
    return report;
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

// ─────────────── запуск ───────────────

const opts = args();
if (opts.build) await buildSite();

const server = await preview({
  root: ROOT,
  configFile: join(ROOT, "vite.config.ts"),
  logLevel: "warn",
  preview: { host: "127.0.0.1", port: 4173, strictPort: false, open: false },
});
const baseUrl = server.resolvedUrls.local[0];
const chrome = await launchChrome({ headed: opts.headed });
try {
  console.log(`Снимки ${baseUrl}`);
  if (opts.network) {
    await networkCheck(chrome.port, baseUrl, join(opts.outDir, "network-slow4g.json"));
  } else if (opts.viewport) {
    const [width, height] = opts.viewport.split("x").map(Number);
    const out = resolve(ROOT, opts.out ?? join(opts.outDir, `shot-${width}x${height}-${opts.mode}-${opts.state}.png`));
    await shot(chrome.port, baseUrl, { width, height, mobile: opts.mobile, mode: opts.mode, state: opts.state, out, wait: opts.wait });
  } else {
    const views = [
      { name: "desktop", width: 1440, height: 900, mobile: false },
      { name: "mobile", width: 390, height: 844, mobile: true },
    ];
    for (const v of views) {
      await shot(chrome.port, baseUrl, { ...v, mode: "full", state: "open", out: join(opts.outDir, `${v.name}.png`), wait: opts.wait });
      for (const state of ["closed", "open"]) {
        await shot(chrome.port, baseUrl, { ...v, mode: "first", state, out: join(opts.outDir, `${v.name}-first-${state}.png`), wait: opts.wait });
      }
    }
  }
} finally {
  await chrome.close();
  await server.close();
}

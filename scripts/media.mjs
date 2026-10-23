// Медиа-конвейер: media-src/ → public/media/ + src/media/manifest.ts.
// Запуск: `npm run media` (`node scripts/media.mjs [--force]`). Ключи и параметры — media.config.mjs.
//
// Картинки (sharp): кроп до пропорции, пресет цветокоррекции, ширины из конфига (не больше исходника),
//   AVIF + WebP + фолбэк (JPEG, или PNG при прозрачности), data-URI плейсхолдер ≤ 1 КБ.
//   Мобильные ширины (≤ 800 px) ужимаются по качеству, пока файл не станет ≤ 240 КБ.
// Видео (ffmpeg-static): MP4 H.264 + WebM VP9, десктоп ≤ 720p ≤ 3 МБ, мобильное ≤ 480p ≤ 1,2 МБ,
//   без звука; битрейт считается от длительности, при перелёте — повтор с меньшим.
// Логотип: media-src/logo/logo.svg → public/media/logo.svg + favicon-32.png + apple-touch-icon.png.
// Нет исходника — плашка-заглушка цвета мира того же размера (`stub: true` в манифесте), сборка не падает.
// Кэш (node_modules/.cache/lapakur-media) пропускает ключи, у которых не менялись исходник и настройки.

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";

const PIPELINE_VERSION = 1;
const MOBILE_MAX_WIDTH = 800;
const MOBILE_IMAGE_TARGET = 240_000;
const VIDEO = {
  desktop: { shortSide: 720, budgetBytes: 3_000_000, maxKbps: 2500 },
  mobile: { shortSide: 480, budgetBytes: 1_200_000, maxKbps: 1000 },
};
const QUALITY = { avif: 52, webp: 74, jpeg: 76, png: 90 };
const IMAGE_EXT = [".png", ".tif", ".tiff", ".webp", ".jpg", ".jpeg", ".avif"];
const VIDEO_EXT = [".mov", ".mp4", ".mkv", ".webm", ".m4v"];
const OUTPUT_FILE = /\.(avif|webp|jpe?g|png|mp4|webm|svg)$/i;

// ─────────────────────────── утилиты ───────────────────────────

function sha1(...parts) {
  const h = createHash("sha1");
  for (const p of parts) h.update(typeof p === "string" ? p : Buffer.isBuffer(p) ? p : JSON.stringify(p));
  return h.digest("hex");
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function runFfmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(ffmpegStatic, args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (chunk) => (stderr += chunk));
    proc.on("error", reject);
    proc.on("close", (code) => resolvePromise({ code, stderr }));
  });
}

async function ffmpeg(args) {
  const { code, stderr } = await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", ...args]);
  if (code !== 0) throw new Error(`ffmpeg ${args.join(" ")}\n${stderr.slice(-2000)}`);
}

async function probeVideo(file) {
  const { stderr } = await runFfmpeg(["-hide_banner", "-i", file]);
  const video = stderr.match(/Video: (\w+)[^\n]*?[ ,](\d{2,5})x(\d{2,5})[ ,\]]/);
  if (!video) throw new Error(`не удалось прочитать видео ${file}`);
  const d = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  const duration = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 10;
  return { width: Number(video[2]), height: Number(video[3]), duration: duration || 10 };
}

/** Размер с короткой стороной не больше `shortSide`, без увеличения, чётные стороны. */
function fitShortSide(width, height, shortSide) {
  const scale = Math.min(1, shortSide / Math.min(width, height));
  return { width: even(width * scale), height: even(height * scale) };
}

/** Ширины выдачи: из конфига, не больше исходника; если исходник уже максимума — последней идёт его ширина. */
export function outputWidths(widths, sourceWidth) {
  const list = [...new Set(widths)].sort((a, b) => a - b).filter((w) => w <= sourceWidth);
  if (sourceWidth < Math.max(...widths) && !list.includes(sourceWidth)) list.push(sourceWidth);
  return list.length ? list : [sourceWidth];
}

// ─────────────────────────── поиск исходников ───────────────────────────

function findSources(srcDir, entries) {
  const files = listFiles(srcDir);
  const byName = new Map();
  for (const file of files) {
    const name = basename(file, extname(file)).toLowerCase();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }
  const found = {};
  const warnings = [];
  for (const [key, entry] of Object.entries(entries)) {
    const allowed = entry.type === "video" ? VIDEO_EXT : IMAGE_EXT;
    const explicit = [entry.src ?? []].flat().map((p) => join(srcDir, p)).find((p) => existsSync(p));
    if (explicit) {
      found[key] = explicit;
      continue;
    }
    const candidates = (byName.get(key.toLowerCase()) ?? [])
      .filter((f) => allowed.includes(extname(f).toLowerCase()))
      .sort((a, b) => allowed.indexOf(extname(a).toLowerCase()) - allowed.indexOf(extname(b).toLowerCase()));
    if (candidates.length > 1) {
      warnings.push(`${key}: несколько исходников, взят ${relative(srcDir, candidates[0])}`);
    }
    if (candidates[0]) found[key] = candidates[0];
  }
  return { found, warnings };
}

// ─────────────────────────── картинки ───────────────────────────

/** Нормализованный мастер: sRGB, кроп, прозрачность, цветокоррекция → raw-буфер. */
async function makeMaster(input, entry, grades, background) {
  const base = await sharp(input, { failOn: "none", limitInputPixels: false })
    .rotate()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  let { data, info } = base;
  const raw = () => ({ raw: { width: info.width, height: info.height, channels: info.channels } });

  let alpha = entry.alpha;
  if (alpha === undefined) alpha = info.channels === 4 && !(await sharp(data, raw()).stats()).isOpaque;

  let img = sharp(data, raw());
  if (alpha && info.channels !== 4) img = img.ensureAlpha();
  if (!alpha && info.channels === 4) img = img.flatten({ background: hexToRgb(background) }).removeAlpha();

  if (entry.crop?.aspect) {
    const [aw, ah] = entry.crop.aspect;
    const [fx, fy] = entry.crop.focus ?? [0.5, 0.5];
    let width = info.width;
    let height = Math.round((width * ah) / aw);
    if (height > info.height) {
      height = info.height;
      width = Math.round((height * aw) / ah);
    }
    img = img.extract({
      left: Math.round((info.width - width) * fx),
      top: Math.round((info.height - height) * fy),
      width,
      height,
    });
  }
  ({ data, info } = await img.raw().toBuffer({ resolveWithObject: true }));

  const grade = grades?.[entry.grade ?? "none"];
  if (entry.grade && entry.grade !== "none" && !grade) throw new Error(`нет пресета цветокоррекции «${entry.grade}»`);
  if (grade) {
    const n = info.channels;
    let g = sharp(data, raw());
    if (grade.saturation !== undefined) g = g.modulate({ saturation: grade.saturation });
    ({ data, info } = await g.raw().toBuffer({ resolveWithObject: true }));
    g = sharp(data, raw());
    if (grade.recomb) g = g.recomb(grade.recomb);
    ({ data, info } = await g.raw().toBuffer({ resolveWithObject: true }));
    if (grade.linear) {
      const [a, b] = grade.linear;
      const mul = Array.from({ length: n }, (_, i) => (i < 3 ? a : 1));
      const add = Array.from({ length: n }, (_, i) => (i < 3 ? b : 0));
      ({ data, info } = await sharp(data, raw()).linear(mul, add).raw().toBuffer({ resolveWithObject: true }));
    }
  }
  return { data, info, alpha };
}

async function encode(master, width, format, quality) {
  const { data, info } = master;
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  if (width !== info.width) img = img.resize({ width, kernel: "lanczos3" });
  switch (format) {
    case "avif":
      return img.avif({ quality, effort: 4 }).toBuffer();
    case "webp":
      return img.webp({ quality, alphaQuality: 90, effort: 5, smartSubsample: true }).toBuffer();
    case "jpg":
      return img.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
    case "png":
      return img.png({ palette: true, quality, effort: 8, compressionLevel: 9 }).toBuffer();
    default:
      throw new Error(`неизвестный формат ${format}`);
  }
}

async function placeholderOf(master) {
  const { data, info } = master;
  const raw = { raw: { width: info.width, height: info.height, channels: info.channels } };
  for (const w of [16, 12, 8]) {
    const buf = await sharp(data, raw).resize({ width: w }).webp({ quality: 40, alphaQuality: 50 }).toBuffer();
    const uri = `data:image/webp;base64,${buf.toString("base64")}`;
    if (uri.length <= 1024) return uri;
  }
  const { dominant } = await sharp(data, raw).stats();
  return toHex(dominant.r, dominant.g, dominant.b);
}

async function processImage(key, master, entry, ctx, { placeholder }) {
  const widths = outputWidths(entry.widths ?? [master.info.width], master.info.width);
  const fallbackExt = master.alpha ? "png" : "jpg";
  const srcsets = { avif: [], webp: [], [fallbackExt]: [] };
  const files = [];
  for (const width of widths) {
    for (const format of ["avif", "webp", fallbackExt]) {
      let quality = entry.quality?.[format === "jpg" ? "jpeg" : format] ?? QUALITY[format === "jpg" ? "jpeg" : format];
      let buf = await encode(master, width, format, quality);
      while (width <= MOBILE_MAX_WIDTH && buf.length > MOBILE_IMAGE_TARGET && quality > 30) {
        quality -= 10;
        buf = await encode(master, width, format, quality);
      }
      const name = `${key}-${width}.${format}`;
      writeFileSync(join(ctx.outDir, name), buf);
      files.push(name);
      srcsets[format].push(`${ctx.publicPath}${name} ${width}w`);
    }
  }
  const maxWidth = widths[widths.length - 1];
  const record = {
    kind: "image",
    width: maxWidth,
    height: Math.round((maxWidth * master.info.height) / master.info.width),
    alpha: master.alpha,
    avif: srcsets.avif.join(", "),
    webp: srcsets.webp.join(", "),
    fallback: srcsets[fallbackExt].join(", "),
    placeholder: placeholder ?? (await placeholderOf(master)),
  };
  return { record, files };
}

function stubMaster(entry) {
  const { width, height, color } = entry.stub;
  const { r, g, b } = hexToRgb(color);
  const channels = entry.alpha ? 4 : 3;
  const data = Buffer.alloc(width * height * channels);
  for (let i = 0; i < data.length; i += channels) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    if (channels === 4) data[i + 3] = 255;
  }
  return { data, info: { width, height, channels }, alpha: Boolean(entry.alpha) };
}

// ─────────────────────────── видео ───────────────────────────

async function encodeVideo(inputArgs, size, duration, profile, outBase) {
  const files = {};
  for (const container of ["mp4", "webm"]) {
    const out = `${outBase}.${container}`;
    let kbps = Math.max(250, Math.min(profile.maxKbps, Math.floor((profile.budgetBytes * 8 * 0.85) / duration / 1000)));
    for (let attempt = 0; attempt < 4; attempt++) {
      const common = [
        ...inputArgs,
        "-map", "0:v:0", "-an", "-sn", "-dn", "-map_metadata", "-1",
        "-vf", `scale=${size.width}:${size.height}:flags=lanczos,format=yuv420p`,
        "-fpsmax", "30",
      ];
      const codec =
        container === "mp4"
          ? ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-b:v", `${kbps}k`,
             "-maxrate", `${Math.round(kbps * 1.4)}k`, "-bufsize", `${kbps * 2}k`, "-movflags", "+faststart"]
          : ["-c:v", "libvpx-vp9", "-b:v", `${kbps}k`, "-deadline", "good", "-cpu-used", "2",
             "-row-mt", "1", "-tile-columns", "1"];
      await ffmpeg([...common, ...codec, out]);
      if (statSync(out).size <= profile.budgetBytes) break;
      kbps = Math.floor(kbps * 0.75);
    }
    files[container] = out;
  }
  return files;
}

async function processVideo(key, source, entry, ctx) {
  let inputArgs;
  let width;
  let height;
  let duration;
  if (source) {
    ({ width, height, duration } = await probeVideo(source));
    inputArgs = ["-i", source];
  } else {
    ({ width, height } = entry.stub);
    duration = entry.stub.seconds ?? 2;
    const color = entry.stub.color.replace("#", "0x");
    inputArgs = ["-f", "lavfi", "-i", `color=c=${color}:s=${width}x${height}:r=24:d=${duration}`];
  }
  const desktop = fitShortSide(width, height, VIDEO.desktop.shortSide);
  const mobile = fitShortSide(width, height, VIDEO.mobile.shortSide);
  const d = await encodeVideo(inputArgs, desktop, duration, VIDEO.desktop, join(ctx.outDir, `${key}-desktop`));
  const m = await encodeVideo(inputArgs, mobile, duration, VIDEO.mobile, join(ctx.outDir, `${key}-mobile`));
  const url = (file) => `${ctx.publicPath}${basename(file)}`;
  const record = {
    kind: "video",
    poster: entry.poster,
    desktop: { mp4: url(d.mp4), webm: url(d.webm) },
    mobile: { mp4: url(m.mp4), webm: url(m.webm) },
    width: desktop.width,
    height: desktop.height,
  };
  return { record, files: [d.mp4, d.webm, m.mp4, m.webm].map((f) => basename(f)) };
}

async function firstFrame(videoSource, tmpDir) {
  const out = join(tmpDir, `${basename(videoSource, extname(videoSource))}-frame.png`);
  await ffmpeg(["-i", videoSource, "-frames:v", "1", "-an", out]);
  return out;
}

// ─────────────────────────── логотип ───────────────────────────

async function processLogo(logo, ctx) {
  const source = logo?.src ? join(ctx.srcDir, logo.src) : null;
  const target = join(ctx.outDir, "logo.svg");
  let svg;
  if (source && existsSync(source)) {
    copyFileSync(source, target);
    svg = readFileSync(source);
  } else {
    svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${logo?.stubColor ?? "#E8C9C2"}"/></svg>\n`,
    );
    writeFileSync(target, svg);
    ctx.stubs.push("logo");
  }
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  await sharp(svg, { density: 384 })
    .resize(32, 32, { fit: "contain", background: transparent })
    .png()
    .toFile(join(ctx.outDir, "favicon-32.png"));
  const bg = hexToRgb(logo?.appleTouchBackground ?? "#FFFFFF");
  const inner = await sharp(svg, { density: 384 }).resize(140, 140, { fit: "contain", background: transparent }).png().toBuffer();
  await sharp({ create: { width: 180, height: 180, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: inner, gravity: "centre" }])
    .png()
    .toFile(join(ctx.outDir, "apple-touch-icon.png"));
  return ["logo.svg", "favicon-32.png", "apple-touch-icon.png"];
}

// ─────────────────────────── манифест ───────────────────────────

function manifestSource(manifest, keys) {
  const lines = [
    "// Сгенерировано scripts/media.mjs из media.config.mjs — руками не править.",
    "// Пересобрать: npm run media",
    "",
    'import type { ImageAsset, VideoAsset } from "./types";',
    "",
    'export type { ImageAsset, VideoAsset, MediaAsset } from "./types";',
    "",
    "export type MediaKey =",
    ...keys.map((k, i) => `  | ${JSON.stringify(k)}${i === keys.length - 1 ? ";" : ""}`),
    "",
    `export const MEDIA_KEYS: readonly MediaKey[] = ${JSON.stringify(keys)};`,
    "",
    "export const MEDIA: Record<MediaKey, ImageAsset | VideoAsset> = {",
    ...keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(manifest[k])},`),
    "};",
    "",
  ];
  return lines.join("\n");
}

// ─────────────────────────── сборка ───────────────────────────

/**
 * Собрать медиа. Пути — абсолютные или от текущей папки; по умолчанию берутся из конфига.
 * @param {{ config: any, srcDir?: string, outDir?: string, manifest?: string, cacheFile?: string | null,
 *           force?: boolean, log?: (line: string) => void }} options
 * @returns {Promise<{ manifest: Record<string, any>, stubs: string[], warnings: string[] }>}
 */
export async function buildMedia(options) {
  const { config } = options;
  const log = options.log ?? ((line) => console.log(line));
  const ctx = {
    srcDir: resolve(options.srcDir ?? config.srcDir),
    outDir: resolve(options.outDir ?? config.outDir),
    publicPath: config.publicPath ?? "media/",
    stubs: [],
  };
  const manifestFile = resolve(options.manifest ?? config.manifest);
  const cacheFile = options.cacheFile === undefined ? config.cacheFile : options.cacheFile;
  const entries = config.entries;
  const keys = Object.keys(entries);
  mkdirSync(ctx.outDir, { recursive: true });

  const cache = cacheFile && existsSync(cacheFile) && !options.force ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
  const nextCache = {};
  const { found, warnings } = findSources(ctx.srcDir, entries);
  const fileHash = new Map();
  const hashOf = (file) => {
    if (!fileHash.has(file)) fileHash.set(file, sha1(readFileSync(file)));
    return fileHash.get(file);
  };

  // откуда берётся каждая картинка: свой исходник → кадр видео → исходник другого ключа → заглушка
  const origin = {};
  for (const key of keys) {
    const entry = entries[key];
    if (found[key]) origin[key] = { kind: "file", file: found[key] };
    else if (entry.frameFrom && found[entry.frameFrom]) origin[key] = { kind: "frame", file: found[entry.frameFrom] };
    else if (entry.srcFrom && found[entry.srcFrom]) origin[key] = { kind: "file", file: found[entry.srcFrom] };
    else if (entry.srcFrom && entry.frameFrom === undefined && entries[entry.srcFrom]?.frameFrom && found[entries[entry.srcFrom].frameFrom]) {
      origin[key] = { kind: "frame", file: found[entries[entry.srcFrom].frameFrom] };
    } else origin[key] = { kind: "stub" };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "lapakur-media-"));
  const manifest = {};
  const produced = new Set();
  try {
    for (const key of keys) {
      const entry = entries[key];
      const from = origin[key];
      const grade = entry.grade ? config.grades?.[entry.grade] : null;
      const hash = sha1(
        String(PIPELINE_VERSION),
        { entry, grade, publicPath: ctx.publicPath },
        from.kind,
        from.file ? hashOf(from.file) : "stub",
      );
      const cached = cache[key];
      if (cached?.hash === hash && cached.files.every((f) => existsSync(join(ctx.outDir, f)))) {
        manifest[key] = cached.record;
        cached.files.forEach((f) => produced.add(f));
        nextCache[key] = cached;
        if (cached.record.stub) ctx.stubs.push(key);
        log(`  ${key}: без изменений`);
        continue;
      }

      let result;
      if (entry.type === "video") {
        result = await processVideo(key, from.kind === "file" ? from.file : null, entry, ctx);
      } else {
        let master;
        let placeholder;
        if (from.kind === "stub") {
          master = stubMaster(entry);
          placeholder = entry.stub.color.toUpperCase();
        } else {
          const input = from.kind === "frame" ? await firstFrame(from.file, tmpDir) : from.file;
          master = await makeMaster(input, entry, config.grades, entry.stub?.color ?? "#FFFFFF");
        }
        result = await processImage(key, master, entry, ctx, { placeholder });
      }
      if (from.kind === "stub") {
        result.record.stub = true;
        ctx.stubs.push(key);
      }
      manifest[key] = result.record;
      result.files.forEach((f) => produced.add(f));
      nextCache[key] = { hash, record: result.record, files: result.files };
      const what = from.kind === "stub" ? "заглушка (нет исходника)" : `← ${relative(process.cwd(), from.file)}${from.kind === "frame" ? " (первый кадр)" : ""}`;
      log(`  ${key}: ${what}`);
    }

    for (const f of await processLogo(config.logo, ctx)) produced.add(f);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  // убрать устаревшие файлы прошлых сборок
  for (const name of readdirSync(ctx.outDir)) {
    if (OUTPUT_FILE.test(name) && !produced.has(name)) rmSync(join(ctx.outDir, name), { force: true });
  }

  mkdirSync(dirname(manifestFile), { recursive: true });
  writeFileSync(manifestFile, manifestSource(manifest, keys));
  if (cacheFile) {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(nextCache, null, 2));
  }
  for (const w of warnings) log(`  ! ${w}`);
  return { manifest, stubs: ctx.stubs, warnings };
}

const isCli = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const { default: config } = await import(pathToFileURL(resolve("media.config.mjs")).href);
  const started = Date.now();
  console.log(`Медиа: ${config.srcDir}/ → ${config.outDir}/`);
  const { stubs } = await buildMedia({ config, force: process.argv.includes("--force") });
  console.log(
    `Готово за ${((Date.now() - started) / 1000).toFixed(1)} с. ` +
      (stubs.length ? `Заглушки (${stubs.length}): ${stubs.join(", ")}` : "Заглушек нет."),
  );
}

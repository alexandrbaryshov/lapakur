// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import config from "../media.config.mjs";
import { buildMedia } from "../scripts/media.mjs";

// Ключи MediaKey — дословно из interfaces.md («Медиа — конвейер и манифест»).
// + hero-mask — маска шапки за тюрбаном (тикет F3, G02).
const INTERFACE_KEYS = [
  "hero-poster", "hero-video", "hero-mask", "curtain", "curtain-rod", "call-dog",
  "breed-bichon", "breed-yorkie", "breed-spitz", "breed-poodle",
  "price-bichon", "price-yorkie", "price-spitz", "price-poodle",
  "works-cocker-black", "works-cocker", "works-bichon", "works-yorkie", "works-spitz", "works-poodle",
  "og-image",
];
const ALPHA_KEYS = ["hero-mask", "curtain-rod", "call-dog", "breed-bichon", "breed-yorkie", "breed-spitz", "breed-poodle"];

type Img = { kind: "image"; width: number; height: number; alpha: boolean; avif: string; webp: string; fallback: string; placeholder: string; stub?: true };
type Vid = { kind: "video"; poster: string; desktop: { mp4: string; webm: string }; mobile: { mp4: string; webm: string }; width: number; height: number; stub?: true };
type Manifest = Record<string, Img | Vid>;

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "lapakur-media-"));
});
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Отдельная песочница: media-src, public/media и манифест во временной папке. */
function sandbox(name: string) {
  const dir = join(root, name);
  const srcDir = join(dir, "media-src");
  const outDir = join(dir, "public", "media");
  mkdirSync(srcDir, { recursive: true });
  return { srcDir, outDir, manifest: join(dir, "manifest.ts") };
}

async function run(box: ReturnType<typeof sandbox>, entries?: Record<string, unknown>) {
  const result = await buildMedia({
    config: entries ? { ...config, entries } : config,
    srcDir: box.srcDir,
    outDir: box.outDir,
    manifest: box.manifest,
    cacheFile: null,
    log: () => {},
  });
  return result.manifest as Manifest;
}

/** «media/a-480.avif 480w, …» → [["a-480.avif", 480], …] */
function candidates(srcset: string): [string, number][] {
  return srcset.split(",").map((part) => {
    const [url, w] = part.trim().split(/\s+/);
    expect(url.startsWith("media/")).toBe(true);
    return [url.slice("media/".length), Number(w.replace("w", ""))];
  });
}

/** Сведения о медиафайле из `ffmpeg -i` (независимо от кода конвейера). */
function probe(file: string) {
  const out = spawnSync(ffmpegPath as unknown as string, ["-hide_banner", "-i", file], { encoding: "utf8" }).stderr;
  const video = out.match(/Video: (\w+)[^\n]*?[ ,](\d{2,5})x(\d{2,5})[ ,\]]/);
  return { codec: video?.[1], width: Number(video?.[2]), height: Number(video?.[3]), audio: /Audio:/.test(out) };
}

const svgGradient = (w: number, h: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#d9a08f"/><stop offset="1" stop-color="#6c7f95"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 3}" fill="#f4e9d8"/></svg>`,
  );

describe("npm run media — пустой media-src/", () => {
  let box: ReturnType<typeof sandbox>;
  let manifest: Manifest;
  beforeAll(async () => {
    box = sandbox("empty");
    manifest = await run(box);
  });

  it("заглушки для всех 21 ключа из interfaces.md", () => {
    expect(Object.keys(manifest).sort()).toEqual([...INTERFACE_KEYS].sort());
    for (const key of INTERFACE_KEYS) expect(manifest[key].stub).toBe(true);
    expect(manifest["hero-video"].kind).toBe("video");
  });

  it("у картинок-заглушек — srcset AVIF/WebP/фолбэк на существующие файлы и цвет-плейсхолдер", () => {
    for (const key of INTERFACE_KEYS.filter((k) => k !== "hero-video")) {
      const asset = manifest[key] as Img;
      expect(asset.kind).toBe("image");
      expect(asset.placeholder).toMatch(/^#[0-9A-F]{6}$/i);
      expect(asset.alpha).toBe(ALPHA_KEYS.includes(key));
      for (const srcset of [asset.avif, asset.webp, asset.fallback]) {
        for (const [file] of candidates(srcset)) expect(existsSync(join(box.outDir, file))).toBe(true);
      }
      expect(candidates(asset.fallback)[0][0]).toMatch(asset.alpha ? /\.png$/ : /\.jpg$/);
    }
  });

  it("обложка — вертикальная пластина 4:5, видео-заглушка с постером hero-poster", () => {
    const poster = manifest["hero-poster"] as Img;
    expect(poster.width / poster.height).toBeCloseTo(4 / 5, 2);
    const video = manifest["hero-video"] as Vid;
    expect(video.poster).toBe("hero-poster");
    for (const url of [video.desktop.mp4, video.desktop.webm, video.mobile.mp4, video.mobile.webm]) {
      expect(existsSync(join(box.outDir, url.replace(/^media\//, "")))).toBe(true);
    }
  });

  it("пишет manifest.ts: тип MediaKey и MEDIA со всеми ключами; лого-заглушка и фавикон на месте", () => {
    const text = readFileSync(box.manifest, "utf8");
    expect(text).toMatch(/export type MediaKey\b/);
    expect(text).toMatch(/export const MEDIA\b/);
    for (const key of INTERFACE_KEYS) expect(text).toContain(`"${key}"`);
    expect(existsSync(join(box.outDir, "logo.svg"))).toBe(true);
    expect(existsSync(join(box.outDir, "favicon-32.png"))).toBe(true);
  });
});

describe("npm run media — картинки", () => {
  it("фото → AVIF/WebP/JPEG ширин 480/800/1200/1600 и data-URI плейсхолдер ≤ 1 КБ", async () => {
    const box = sandbox("photo");
    await sharp(svgGradient(1700, 1100)).jpeg({ quality: 90 }).toFile(join(box.srcDir, "photo.jpg"));
    const manifest = await run(box, {
      photo: { type: "image", widths: [480, 800, 1200, 1600], stub: { width: 10, height: 10, color: "#ffffff" } },
    });
    const asset = manifest.photo as Img;
    expect(asset.stub).toBeUndefined();
    expect(asset.alpha).toBe(false);
    expect([asset.width, asset.height]).toEqual([1600, Math.round((1100 * 1600) / 1700)]);
    expect(asset.placeholder.startsWith("data:image/")).toBe(true);
    expect(asset.placeholder.length).toBeLessThanOrEqual(1024);
    const formats: [string, string][] = [[asset.avif, "heif"], [asset.webp, "webp"], [asset.fallback, "jpeg"]];
    for (const [srcset, format] of formats) {
      const list = candidates(srcset);
      expect(list.map(([, w]) => w)).toEqual([480, 800, 1200, 1600]);
      for (const [file, w] of list) {
        const meta = await sharp(join(box.outDir, file)).metadata();
        expect(meta.format).toBe(format);
        expect(meta.width).toBe(w);
      }
    }
  });

  it("ширины не больше исходника: из 600 px — 480 и 600", async () => {
    const box = sandbox("small");
    await sharp(svgGradient(600, 750)).png().toFile(join(box.srcDir, "small.png"));
    const manifest = await run(box, {
      small: { type: "image", widths: [480, 800, 1200, 1600], stub: { width: 10, height: 10, color: "#ffffff" } },
    });
    expect(candidates((manifest.small as Img).webp).map(([, w]) => w)).toEqual([480, 600]);
  });

  it("PNG с прозрачностью → альфа сохранена в AVIF и WebP, фолбэк PNG", async () => {
    const box = sandbox("alpha");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><circle cx="250" cy="250" r="150" fill="#1e1b18"/></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(join(box.srcDir, "line.png"));
    const manifest = await run(box, {
      line: { type: "image", widths: [240, 480], stub: { width: 10, height: 10, color: "#ffffff" } },
    });
    const asset = manifest.line as Img;
    expect(asset.alpha).toBe(true);
    for (const srcset of [asset.avif, asset.webp, asset.fallback]) {
      const [file] = candidates(srcset)[candidates(srcset).length - 1];
      const { data, info } = await sharp(join(box.outDir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect((await sharp(join(box.outDir, file)).metadata()).hasAlpha).toBe(true);
      expect(data[3]).toBe(0); // угол прозрачный
      const centre = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
      expect(data[centre + 3]).toBeGreaterThan(240); // центр — непрозрачная линия
    }
    expect(candidates(asset.fallback)[0][0]).toMatch(/\.png$/);
  });

  it("пресет warm-editorial из конфига теплит нейтральный серый, размер кадра тот же", async () => {
    const box = sandbox("grade");
    const grey = { create: { width: 400, height: 500, channels: 3 as const, background: { r: 128, g: 128, b: 128 } } };
    await sharp(grey).png().toFile(join(box.srcDir, "neutral.png"));
    await sharp(grey).png().toFile(join(box.srcDir, "warm.png"));
    const stub = { width: 10, height: 10, color: "#ffffff" };
    const manifest = await run(box, {
      neutral: { type: "image", widths: [400], grade: "none", stub },
      warm: { type: "image", widths: [400], grade: "warm-editorial", stub },
    });
    const mean = async (key: string) => {
      const [file] = candidates((manifest[key] as Img).fallback)[0];
      const meta = await sharp(join(box.outDir, file)).metadata();
      expect([meta.width, meta.height]).toEqual([400, 500]);
      const { channels } = await sharp(join(box.outDir, file)).stats();
      return channels.map((c) => c.mean);
    };
    const [nr, , nb] = await mean("neutral");
    const [wr, , wb] = await mean("warm");
    expect(Math.abs(nr - nb)).toBeLessThan(2);
    expect(wr - wb).toBeGreaterThan(8);
  });
});

describe("npm run media — логотип", () => {
  it("media-src/logo/logo.svg копируется в public/media/logo.svg и становится фавиконом", async () => {
    const box = sandbox("logo");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 90 C 30 10, 70 10, 90 90" fill="none" stroke="currentColor" stroke-width="4"/></svg>`;
    mkdirSync(join(box.srcDir, "logo"));
    writeFileSync(join(box.srcDir, "logo", "logo.svg"), svg);
    await run(box, {});
    expect(readFileSync(join(box.outDir, "logo.svg"), "utf8")).toBe(svg);
    const favicon = await sharp(join(box.outDir, "favicon-32.png")).metadata();
    expect([favicon.format, favicon.width, favicon.height]).toEqual(["png", 32, 32]);
    const touch = await sharp(join(box.outDir, "apple-touch-icon.png")).metadata();
    expect([touch.width, touch.height]).toEqual([180, 180]);
  });
});

// Маска шапки за тюрбаном (тикет F3): альфа = видимость верхнего слоя шапки ЛАПАКЮР над пластиной.
// Кадр маски — пластина обложки шириной W (кадр постера 4:5) с полем FIELD·W вокруг; масштаб по x и y один.
// Точки — на исходном постере media-src/hero-poster.jpg (1856 × 2304; конвейер режет 4:5 → 1843 × 2304 по центру).
describe("маска шапки hero-mask в public/media", () => {
  const FIELD = 8 / 1200;
  const POSTER_CROP = { left: 7, width: 1843 };
  const posterPoint = (x: number, y: number) => ({ u: (x - POSTER_CROP.left) / POSTER_CROP.width, v: y / POSTER_CROP.width });

  it("ключ с альфой из media-src/hero-mask.png; PNG ≤ 15 КБ: прозрачна на тюрбане, непрозрачна над плиткой и в поле у края пластины", async () => {
    const entry = (config.entries as Record<string, { type: string; alpha?: boolean }>)["hero-mask"];
    expect(entry).toMatchObject({ type: "image", alpha: true });
    const { MEDIA } = await import("../src/media/manifest");
    const asset = (MEDIA as unknown as Manifest)["hero-mask"] as Img;
    expect(asset.stub).toBeUndefined();
    expect(asset.alpha).toBe(true);
    const [file] = candidates(asset.fallback)[0];
    const path = join(process.cwd(), "public", "media", file);
    expect(file).toMatch(/\.png$/);
    expect(readFileSync(path).length).toBeLessThanOrEqual(15_000);

    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const perW = info.width / (1 + 2 * FIELD);
    const alphaAt = ({ u, v }: { u: number; v: number }) => {
      const x = Math.round((u + FIELD) * perW);
      const y = Math.round((v + FIELD) * perW);
      return data[(y * info.width + x) * info.channels + 3];
    };
    // тюрбан: середина над очками и левый низ полотенца — буквы здесь уходят за голову
    expect(alphaAt(posterPoint(863, 604))).toBeLessThan(10);
    expect(alphaAt(posterPoint(700, 900))).toBeLessThan(10);
    // плитка над тюрбаном, слева и справа от него — буквы лежат поверх фото
    expect(alphaAt(posterPoint(863, 260))).toBeGreaterThan(245);
    expect(alphaAt(posterPoint(324, 647))).toBeGreaterThan(245);
    expect(alphaAt(posterPoint(1300, 640))).toBeGreaterThan(245);
    // поле за левым краем пластины непрозрачно (буква, пересекающая край, не рвётся)
    expect(alphaAt({ u: -FIELD / 2, v: 0.35 })).toBeGreaterThan(245);
  });
});

describe("npm run media — видео", () => {
  it("MP4 H.264 + WebM, десктоп ≤ 720p и мобильное ≤ 480p без звука, постер из первого кадра", async () => {
    const box = sandbox("video");
    const src = join(box.srcDir, "clip.mp4");
    const made = spawnSync(ffmpegPath as unknown as string, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=960x1200:rate=24:duration=1",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src,
    ]);
    expect(made.status).toBe(0);
    expect(probe(src).audio).toBe(true);

    const manifest = await run(box, {
      clip: { type: "video", poster: "clip-poster", stub: { width: 10, height: 10, color: "#ffffff", seconds: 1 } },
      "clip-poster": { type: "image", widths: [480, 800, 1200, 1600], frameFrom: "clip", stub: { width: 10, height: 10, color: "#ffffff" } },
    });

    const clip = manifest.clip as Vid;
    expect(clip).toEqual({
      kind: "video",
      poster: "clip-poster",
      desktop: { mp4: "media/clip-desktop.mp4", webm: "media/clip-desktop.webm" },
      mobile: { mp4: "media/clip-mobile.mp4", webm: "media/clip-mobile.webm" },
      width: 720,
      height: 900,
    });
    const file = (url: string) => join(box.outDir, url.replace(/^media\//, ""));
    expect(probe(file(clip.desktop.mp4))).toEqual({ codec: "h264", width: 720, height: 900, audio: false });
    expect(probe(file(clip.desktop.webm))).toMatchObject({ codec: "vp9", width: 720, height: 900, audio: false });
    expect(probe(file(clip.mobile.mp4))).toEqual({ codec: "h264", width: 480, height: 600, audio: false });
    expect(probe(file(clip.mobile.webm))).toMatchObject({ codec: "vp9", width: 480, height: 600, audio: false });

    const poster = manifest["clip-poster"] as Img;
    expect(poster.kind).toBe("image");
    expect(poster.stub).toBeUndefined();
    expect([poster.width, poster.height]).toEqual([960, 1200]);
  });
});

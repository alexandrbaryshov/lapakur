import { COVER_CITY, COVER_LINES, type CoverLine } from "../../data/cover";
import { STUDIO } from "../../data/studio";
import {
  BARCODE,
  COVER_BLOCKS,
  COVER_H,
  COVER_TYPE,
  COVER_W,
  MASTHEAD,
  OCCLUSION_FADE,
  OCCLUSION_TOP,
  PRATA_CAP,
  type TextBlock,
} from "./layout";
import { coverDate, type View } from "./view";

// Отрисовка обложки на canvas: кадр с журнальной цветокоррекцией, шапка ЛАПАКЮР, голова питомца
// перед нижней частью шапки (по маске), строки обложки, штрихкод. Цвет каждой строки — чернила
// или фарфор — выбирается по яркости фото под ней. Только в браузере (canvas, document.fonts).

const PRATA = '"Prata", Georgia, serif';
const JOST = '"Jost", "Century Gothic", system-ui, sans-serif';
const CAPS_TRACKING = 0.08;

type Palette = { ink: string; porcelain: string; inkShadow: string; porcelainGlow: string };

/** «#rrggbb» → «rgb(r g b / a)». */
function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/** Цвета — из токенов страницы (tokens.css), в секциях сырых цветов нет. */
function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const ink = read("--color-ink", "#141312");
  const porcelain = read("--color-porcelain", "#f8f7f3");
  return { ink, porcelain, inkShadow: withAlpha(ink, 0.5), porcelainGlow: withAlpha(porcelain, 0.3) };
}

/** Шрифты обложки загружены (кириллица и латиница обоих начертаний) — иначе canvas возьмёт запасной. */
export async function ensureCoverFonts(): Promise<void> {
  if (!document.fonts) return;
  const sample = "ЛАПАКЮРЁЙЩЪ Lapakur 0123456789–«»№";
  await Promise.all([
    document.fonts.load(`400 100px ${PRATA}`, sample),
    document.fonts.load(`400 100px ${JOST}`, sample),
    document.fonts.load(`500 100px ${JOST}`, sample),
  ]).catch(() => {});
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2d недоступен");
  return { c, ctx };
}

/** Собственный размер источника: видео — кадр потока, картинка — натуральный (с учётом EXIF), canvas — как есть. */
function sourceSize(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  const { width, height } = source as { width: number; height: number };
  return { w: width, h: height };
}

/** Кадр обложки 1080 × 1440 из источника: вид view — масштаб и сдвиг в единицах обложки. */
export function framePhoto(source: CanvasImageSource, view: View, mirror = false): HTMLCanvasElement {
  const { c, ctx } = canvas(COVER_W, COVER_H);
  ctx.imageSmoothingQuality = "high";
  if (mirror) {
    ctx.translate(COVER_W, 0);
    ctx.scale(-1, 1);
  }
  const { w, h } = sourceSize(source);
  ctx.drawImage(source, view.x, view.y, w * view.scale, h * view.scale);
  return c;
}

/** Уменьшенная копия кадра для сегментации (маска растягивается обратно на всю обложку). */
export function shrink(frame: HTMLCanvasElement, factor = 2): HTMLCanvasElement {
  const { c, ctx } = canvas(Math.round(frame.width / factor), Math.round(frame.height / factor));
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(frame, 0, 0, c.width, c.height);
  return c;
}

export type Graded = {
  canvas: HTMLCanvasElement;
  /** Яркость 0…1 по клеткам 20 × 20 px кадра (54 × 72). */
  luma: Float32Array;
};

const CELL = 20;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Журнальная цветокоррекция: чуть теплее, чуть спокойнее по насыщенности, мягкий контраст
 * и виньетка к краям (на краях — строки обложки, им нужен ровный фон).
 */
export function gradePhoto(frame: HTMLCanvasElement): Graded {
  const { c, ctx } = canvas(COVER_W, COVER_H);
  ctx.drawImage(frame, 0, 0);
  const image = ctx.getImageData(0, 0, COVER_W, COVER_H);
  const d = image.data;
  const cx = COVER_W / 2;
  const cy = COVER_H * 0.46;
  for (let y = 0; y < COVER_H; y++) {
    const dy = (y - cy) / (COVER_H * 0.56);
    for (let x = 0; x < COVER_W; x++) {
      const dx = (x - cx) / (COVER_W * 0.56);
      const v = 1 - 0.34 * smooth(0.62, 1.32, Math.sqrt(dx * dx + dy * dy));
      const o = (y * COVER_W + x) * 4;
      const r = d[o];
      const g = d[o + 1];
      const b = d[o + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      // насыщенность 0,9 → тепло → контраст 1,06 → виньетка
      const rs = (l + (r - l) * 0.9) * 1.04 + 3;
      const gs = (l + (g - l) * 0.9) * 1.005;
      const bs = (l + (b - l) * 0.9) * 0.92;
      d[o] = ((rs - 128) * 1.06 + 128) * v;
      d[o + 1] = ((gs - 128) * 1.06 + 128) * v;
      d[o + 2] = ((bs - 128) * 1.06 + 128) * v;
    }
  }
  ctx.putImageData(image, 0, 0);

  const cols = COVER_W / CELL;
  const rows = COVER_H / CELL;
  const { ctx: small } = canvas(cols, rows);
  small.imageSmoothingQuality = "high";
  small.drawImage(c, 0, 0, cols, rows);
  const px = small.getImageData(0, 0, cols, rows).data;
  const luma = new Float32Array(cols * rows);
  for (let i = 0; i < luma.length; i++) luma[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  return { canvas: c, luma };
}

type Box = { x: number; y: number; w: number; h: number };

function lumaOf(luma: Float32Array, box: Box) {
  const cols = COVER_W / CELL;
  const x0 = Math.max(0, Math.floor(box.x / CELL));
  const x1 = Math.min(cols - 1, Math.floor((box.x + box.w) / CELL));
  const y0 = Math.max(0, Math.floor(box.y / CELL));
  const y1 = Math.min(COVER_H / CELL - 1, Math.floor((box.y + box.h) / CELL));
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      sum += luma[y * cols + x];
      n++;
    }
  }
  return n ? sum / n : 0.5;
}

// ───────────── набор ─────────────

type Run = { text: string; font: string; size: number; x: number; baseline: number; tracking: number; align: "left" | "right" };

const upper = (s: string) => s.toLocaleUpperCase("ru");

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  if (!tracking) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width;
  return w + tracking * Math.max(0, [...text].length - 1);
}

function setFont(ctx: CanvasRenderingContext2D, font: string, size: number) {
  ctx.font = `${font.split("|")[0]} ${size}px ${font.split("|")[1]}`;
}

const PRATA_400 = `400|${PRATA}`;
const JOST_400 = `400|${JOST}`;
const JOST_500 = `500|${JOST}`;

function widthOf(ctx: CanvasRenderingContext2D, text: string, font: string, size: number, tracking = 0) {
  setFont(ctx, font, size);
  return trackedWidth(ctx, text, tracking * size);
}

/** Переносит слова по ширине; слово шире строки остаётся целым. */
function wrap(ctx: CanvasRenderingContext2D, text: string, font: string, size: number, width: number, tracking = 0) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(ctx, next, font, size, tracking) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Кегль, при котором самая широкая строка помещается в ширину, но не крупнее max. */
function fitSize(ctx: CanvasRenderingContext2D, lines: readonly string[], font: string, width: number, max: number) {
  const widest = Math.max(...lines.map((l) => widthOf(ctx, l, font, 100))) / 100;
  return Math.min(max, width / widest);
}

/** Блок «заголовок дидоном + подпись капителями» от верха или от низа. */
function lineRuns(ctx: CanvasRenderingContext2D, block: TextBlock, line: CoverLine, subFont = JOST_400, subSize = COVER_TYPE.lineSub) {
  const head = line.head.map(upper);
  const headSize = fitSize(ctx, head, PRATA_400, block.width, COVER_TYPE.lineHead);
  const sub = line.sub.flatMap((s) => wrap(ctx, upper(s), subFont, subSize, block.width, CAPS_TRACKING));
  const subLead = subSize * 1.34;
  const gap = headSize * 0.32;
  const height = head.length * headSize + gap + sub.length * subLead;
  const top = block.top ?? (block.bottom ?? 0) - height;
  const runs: Run[] = [];
  head.forEach((text, i) =>
    runs.push({ text, font: PRATA_400, size: headSize, x: block.x, baseline: top + (i + 0.82) * headSize, tracking: 0, align: block.align }),
  );
  const subTop = top + head.length * headSize + gap;
  sub.forEach((text, i) =>
    runs.push({ text, font: subFont, size: subSize, x: block.x, baseline: subTop + i * subLead + subSize * 0.95, tracking: CAPS_TRACKING, align: block.align }),
  );
  return { runs, box: boxOf(block, top, height) };
}

function boxOf(block: TextBlock, top: number, height: number): Box {
  return { x: block.align === "left" ? block.x : block.x - block.width, y: top, w: block.width, h: height };
}

/** Звезда номера: имя питомца крупно дидоном и сенсация под ним; без имени сенсация — заголовком. */
function starRuns(ctx: CanvasRenderingContext2D, name: string, sensation: string) {
  const block = COVER_BLOCKS.star;
  const runs: Run[] = [];
  const title = upper(name.trim());
  let headLines: string[];
  let headSize: number;
  let sub: string[];
  if (title) {
    headSize = fitSize(ctx, [title], PRATA_400, block.width, COVER_TYPE.starName);
    headLines = [title];
    if (headSize < COVER_TYPE.starNameMin) {
      headSize = COVER_TYPE.starNameMin;
      headLines = wrap(ctx, title, PRATA_400, headSize, block.width);
      headSize = Math.min(headSize, fitSize(ctx, headLines, PRATA_400, block.width, headSize));
    }
    sub = wrap(ctx, upper(sensation), JOST_500, COVER_TYPE.starSub, block.width - 60, CAPS_TRACKING);
  } else {
    headSize = COVER_TYPE.starHeadline;
    headLines = wrap(ctx, upper(sensation), PRATA_400, headSize, block.width);
    while (headLines.length > 3 && headSize > 60) {
      headSize -= 6;
      headLines = wrap(ctx, upper(sensation), PRATA_400, headSize, block.width);
    }
    headSize = Math.min(headSize, fitSize(ctx, headLines, PRATA_400, block.width, headSize));
    sub = [];
  }
  // от верха заглавных первой строки до базовой линии последней, затем подпись на 0,3 кегля ниже
  const subSize = COVER_TYPE.starSub;
  const subLead = subSize * 1.3;
  const lead = headSize * 0.98;
  const headHeight = headSize * PRATA_CAP + (headLines.length - 1) * lead;
  const gap = sub.length ? headSize * 0.3 : 0;
  const height = headHeight + gap + sub.length * subLead;
  const top = (block.bottom ?? 0) - height;
  headLines.forEach((text, i) =>
    runs.push({ text, font: PRATA_400, size: headSize, x: block.x, baseline: top + headSize * PRATA_CAP + i * lead, tracking: 0, align: "left" }),
  );
  const subTop = top + headHeight + gap;
  sub.forEach((text, i) =>
    runs.push({ text, font: JOST_500, size: subSize, x: block.x, baseline: subTop + i * subLead + subSize * 0.75, tracking: CAPS_TRACKING, align: "left" }),
  );
  return { runs, box: boxOf(block, top, height) };
}

function drawRun(ctx: CanvasRenderingContext2D, run: Run) {
  setFont(ctx, run.font, run.size);
  const tracking = run.tracking * run.size;
  if (!tracking) {
    ctx.textAlign = run.align;
    ctx.fillText(run.text, run.x, run.baseline);
    return;
  }
  ctx.textAlign = "left";
  let x = run.align === "left" ? run.x : run.x - trackedWidth(ctx, run.text, tracking);
  for (const ch of run.text) {
    ctx.fillText(ch, x, run.baseline);
    x += ctx.measureText(ch).width + tracking;
  }
}

/** Светлый фон — чернила с лёгким фарфоровым ореолом; тёмный — фарфор с мягкой тенью. */
function paint(ctx: CanvasRenderingContext2D, runs: Run[], light: boolean, palette: Palette) {
  ctx.save();
  ctx.fillStyle = light ? palette.ink : palette.porcelain;
  ctx.shadowColor = light ? palette.porcelainGlow : palette.inkShadow;
  ctx.shadowBlur = light ? 10 : 18;
  ctx.shadowOffsetY = light ? 0 : 2;
  for (const run of runs) drawRun(ctx, run);
  ctx.restore();
}

const LIGHT = 0.58;

/** Штрихкод номера: полосы по цифрам телефона студии, под ними — сам номер. */
function drawBarcode(ctx: CanvasRenderingContext2D, palette: Palette) {
  const digits = STUDIO.phoneHref.replace(/\D/g, "");
  const { x, y, w, h } = BARCODE;
  ctx.save();
  ctx.fillStyle = palette.porcelain;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = palette.ink;
  const pattern = [1, 1, 1, ...[...digits].flatMap((d) => [1 + (+d % 3), 1 + ((+d + 1) % 2), 1 + ((+d * 7) % 3), 1]), 1, 1, 1];
  const unit = (w - 24) / pattern.reduce((a, b) => a + b, 0);
  let bx = x + 12;
  pattern.forEach((width, i) => {
    if (i % 2 === 0) ctx.fillRect(bx, y + 10, width * unit, h - 38);
    bx += width * unit;
  });
  const label = `${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  const labelWidth = widthOf(ctx, label, JOST_400, 17, 0.12);
  drawRun(ctx, { text: label, font: JOST_400, size: 17, x: x + (w - labelWidth) / 2, baseline: y + h - 10, tracking: 0.12, align: "left" });
  ctx.restore();
}

export type CoverInput = {
  graded: Graded;
  /** Маска питомца (альфа) на весь кадр; null — шапка целиком поверх фото. */
  mask: HTMLCanvasElement | null;
  name: string;
  sensation: string;
  date: Date;
};

export function renderCover(target: HTMLCanvasElement, { graded, mask, name, sensation, date }: CoverInput) {
  target.width = COVER_W;
  target.height = COVER_H;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  const palette = readPalette();
  ctx.textBaseline = "alphabetic";
  ctx.drawImage(graded.canvas, 0, 0);

  // шапка: краска ЛАПАКЮР ровно от поля до поля
  const word = upper(STUDIO.name);
  setFont(ctx, PRATA_400, MASTHEAD.size);
  const m = ctx.measureText(word);
  const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const size = MASTHEAD.size * ((MASTHEAD.right - MASTHEAD.left) / ink);
  const mastBox = { x: MASTHEAD.left, y: MASTHEAD.capTop, w: MASTHEAD.right - MASTHEAD.left, h: MASTHEAD.capHeight };
  paint(
    ctx,
    [{ text: word, font: PRATA_400, size, x: MASTHEAD.left + m.actualBoundingBoxLeft * (size / MASTHEAD.size), baseline: MASTHEAD.baseline, tracking: 0, align: "left" }],
    lumaOf(graded.luma, mastBox) > LIGHT,
    palette,
  );

  // голова питомца перед нижней частью шапки
  if (mask) {
    const band = Math.ceil(MASTHEAD.baseline + 40);
    const { c: cut, ctx: cc } = canvas(COVER_W, band);
    cc.drawImage(graded.canvas, 0, 0, COVER_W, band, 0, 0, COVER_W, band);
    cc.globalCompositeOperation = "destination-in";
    cc.imageSmoothingQuality = "high";
    cc.drawImage(mask, 0, 0, mask.width, (mask.height * band) / COVER_H, 0, 0, COVER_W, band);
    const fade = cc.createLinearGradient(0, OCCLUSION_TOP, 0, OCCLUSION_TOP + OCCLUSION_FADE);
    fade.addColorStop(0, "rgb(0 0 0 / 0)");
    fade.addColorStop(1, "rgb(0 0 0 / 1)");
    cc.fillStyle = fade;
    cc.fillRect(0, 0, COVER_W, band);
    ctx.drawImage(cut, 0, 0);
  }

  // дата номера
  const dateBlock = COVER_BLOCKS.date;
  const dateRun: Run = {
    text: upper(`${COVER_CITY} · ${coverDate(date)}`),
    font: JOST_500,
    size: COVER_TYPE.date,
    x: dateBlock.x,
    baseline: dateBlock.top + COVER_TYPE.date,
    tracking: 0.14,
    align: "right",
  };
  paint(ctx, [dateRun], lumaOf(graded.luma, boxOf(dateBlock, dateBlock.top, COVER_TYPE.date * 1.4)) > LIGHT, palette);

  // строки обложки о студии
  const blocks = [
    lineRuns(ctx, COVER_BLOCKS.services, COVER_LINES.services),
    lineRuns(ctx, COVER_BLOCKS.address, COVER_LINES.address),
    lineRuns(ctx, COVER_BLOCKS.booking, COVER_LINES.booking, JOST_500, 27),
    starRuns(ctx, name, sensation),
  ];
  for (const { runs, box } of blocks) paint(ctx, runs, lumaOf(graded.luma, box) > LIGHT, palette);

  // короткая линейка под строкой услуг — как в журнале
  const services = blocks[0];
  const light = lumaOf(graded.luma, services.box) > LIGHT;
  ctx.fillStyle = light ? palette.ink : palette.porcelain;
  ctx.fillRect(COVER_BLOCKS.services.x, services.box.y + services.box.h + 22, 64, 2);

  drawBarcode(ctx, palette);
}

/** JPEG готовой обложки для сохранения и «Поделиться». */
export function coverBlob(target: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    target.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("не удалось сохранить обложку"))), "image/jpeg", 0.92),
  );
}

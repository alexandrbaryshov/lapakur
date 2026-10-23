import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { m } from "motion/react";
import { CallButton } from "../src/components/CallButton";
import { useZoom } from "../src/components/zoom";
import { MotionProvider } from "../src/components/MotionProvider";
import { PriceChapters } from "../src/components/PriceChapters";
import {
  HERO_INK_PATH,
  buildThread,
  drawnFraction,
  scalePath,
  type Box,
  type InkSamples,
  type ThreadLayout,
} from "../src/components/InkLine.geometry";

// Ожидания — из spec.md (история 29, R30/R31) и тикета 05: наведение и нажатие дают приближение
// ≈ 1.03–1.05 на пружине; при prefers-reduced-motion — нет.

let reduced = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? reduced : false;
    },
    media: query,
    onchange: null,
    addListener: (fn: () => void) => listeners.add(fn),
    removeListener: (fn: () => void) => listeners.delete(fn),
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    dispatchEvent: () => false,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Переключить системную настройку «уменьшить движение» (Motion слушает change). */
function setReducedMotion(value: boolean) {
  reduced = value;
  for (const fn of listeners) fn();
}

/** Масштаб из inline transform («scale(1.05)» или «none»). */
function scaleOf(el: Element) {
  const transform = (el as HTMLElement).style.transform;
  const m = /scale\(([\d.]+)\)/.exec(transform);
  return m ? Number(m[1]) : 1;
}

async function settle(ms = 900) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe("приближение по наведению и нажатию (R30, R31)", () => {
  it("кнопка «Записаться»: нажатие приближает собаку у телефона (1.03–1.05), а не уменьшает", async () => {
    setReducedMotion(false);
    const { container } = render(
      <MotionProvider>
        <CallButton variant="hero" />
      </MotionProvider>,
    );
    const link = container.querySelector("a")!;
    const dog = link.querySelector("img")!.closest("span")!;
    await settle(50);
    fireEvent.pointerDown(link, { pointerType: "mouse", button: 0, isPrimary: true });
    await settle();
    expect(scaleOf(dog)).toBeGreaterThanOrEqual(1.03);
    expect(scaleOf(dog)).toBeLessThanOrEqual(1.05);
    fireEvent.pointerUp(link, { pointerType: "mouse", button: 0, isPrimary: true });
  });

  it("кнопка «Записаться»: наведение приближает собаку (1.03–1.05)", async () => {
    setReducedMotion(false);
    const { container } = render(
      <MotionProvider>
        <CallButton variant="hero" />
      </MotionProvider>,
    );
    const link = container.querySelector("a")!;
    const dog = link.querySelector("img")!.closest("span")!;
    await settle(50);
    fireEvent.pointerEnter(link, { pointerType: "mouse" });
    await settle();
    await waitFor(() => expect(scaleOf(dog)).toBeGreaterThanOrEqual(1.03));
    expect(scaleOf(dog)).toBeLessThanOrEqual(1.05);
  });

  /** Наибольший масштаб на пути от элемента вверх до `stop` включительно. */
  function scaleOnPath(el: Element, stop: Element) {
    let max = 1;
    for (let node: Element | null = el; node; node = node.parentElement) {
      max = Math.max(max, scaleOf(node));
      if (node === stop) break;
    }
    return max;
  }

  it("главы прайса (карточки пород): наведение и нажатие приближают силуэт породы (1.03–1.05)", async () => {
    setReducedMotion(false);
    const { container } = render(
      <MotionProvider>
        <PriceChapters />
      </MotionProvider>,
    );
    const chapters = [...container.querySelectorAll("li[data-chapter]")];
    expect(chapters).toHaveLength(4);
    await settle(50);

    const [first, second] = chapters;
    fireEvent.pointerEnter(first, { pointerType: "mouse" });
    await settle();
    const hovered = scaleOnPath(first.querySelector("img")!, first);
    expect(hovered).toBeGreaterThanOrEqual(1.03);
    expect(hovered).toBeLessThanOrEqual(1.05);

    fireEvent.pointerDown(second, { pointerType: "touch", isPrimary: true });
    await settle();
    const tapped = scaleOnPath(second.querySelector("img")!, second);
    expect(tapped).toBeGreaterThanOrEqual(1.03);
    expect(tapped).toBeLessThanOrEqual(1.05);
    fireEvent.pointerUp(second, { pointerType: "touch", isPrimary: true });
  });

  it("главы прайса при reduced-motion не приближаются", async () => {
    setReducedMotion(true);
    const { container } = render(
      <MotionProvider>
        <PriceChapters />
      </MotionProvider>,
    );
    const first = container.querySelector("li[data-chapter]")!;
    await settle(50);
    fireEvent.pointerEnter(first, { pointerType: "mouse" });
    fireEvent.pointerDown(first, { pointerType: "touch", isPrimary: true });
    await settle();
    expect(scaleOnPath(first.querySelector("img")!, first)).toBe(1);
  });

  it("фото (useZoom из interfaces.md): наведение и нажатие приближают 1.03–1.05, при reduced-motion — нет", async () => {
    function Photo() {
      return <m.div data-testid="photo" {...useZoom(1.03)} />;
    }
    setReducedMotion(false);
    const first = render(
      <MotionProvider>
        <Photo />
      </MotionProvider>,
    );
    const photo = first.getByTestId("photo");
    await settle(50);
    fireEvent.pointerEnter(photo, { pointerType: "mouse" });
    await settle();
    expect(scaleOf(photo)).toBeCloseTo(1.03, 2);
    fireEvent.pointerDown(photo, { pointerType: "touch", isPrimary: true });
    await settle();
    expect(scaleOf(photo)).toBeGreaterThanOrEqual(1.03);
    expect(scaleOf(photo)).toBeLessThanOrEqual(1.05);
    first.unmount();

    setReducedMotion(true);
    const second = render(
      <MotionProvider>
        <Photo />
      </MotionProvider>,
    );
    const still = second.getByTestId("photo");
    await settle(50);
    fireEvent.pointerEnter(still, { pointerType: "mouse" });
    fireEvent.pointerDown(still, { pointerType: "touch", isPrimary: true });
    await settle();
    expect(scaleOf(still)).toBe(1);
  });

  it("при reduced-motion наведение и нажатие ничего не приближают", async () => {
    setReducedMotion(true);
    const { container } = render(
      <MotionProvider>
        <CallButton variant="hero" />
      </MotionProvider>,
    );
    const link = container.querySelector("a")!;
    const dog = link.querySelector("img")!.closest("span")!;
    await settle(50);
    fireEvent.pointerEnter(link, { pointerType: "mouse" });
    fireEvent.pointerDown(link, { pointerType: "mouse", button: 0, isPrimary: true });
    await settle();
    expect(scaleOf(link)).toBe(1);
    expect(scaleOf(dog)).toBe(1);
  });
});

// ───────────────────────── сквозная линия ─────────────────────────
// Раскладки сняты с собранной страницы (vite preview, Chrome) на 390 и 1440 px — прямоугольники
// [x, y, w, h] в px страницы; для заголовков и телефона — рамка текста, а не блока.

const box = ([x, y, w, h]: number[]): Box => ({ x, y, w, h });

const PHONE_390: ThreadLayout = {
  width: 390,
  logo: box([17, 12, 72, 72]),
  call: box([239, 24, 134, 49]),
  navLinks: [[31, 92, 47, 44], [108, 92, 53, 44], [191, 92, 68, 44], [288, 92, 70, 44]].map(box),
  masthead: box([17, 160, 357, 62]),
  plate: box([67, 187, 257, 321]),
  tagline: box([17, 529, 263, 56]),
  services: box([17, 599, 317, 44]),
  priceHeading: box([29, 732, 138, 49]),
  pricePhotos: box([29, 1733, 333, 517]),
  sheets: [[29, 2361, 333, 1050], [29, 3484, 333, 1171], [29, 4727, 333, 1119]].map(box),
  priceBottom: 5958,
  worksTitle: box([17, 6064, 265, 123]),
  works: [[24, 6236, 152, 226], [214, 6308, 152, 242], [24, 6612, 343, 464], [24, 7138, 152, 242], [214, 7210, 152, 242], [24, 7514, 343, 464]].map(box),
  faqTitle: box([17, 8202, 211, 49]),
  faqList: box([17, 8277, 357, 656]),
  contactsTitle: box([17, 9110, 229, 49]),
  phone: box([17, 9195, 270, 45]),
};

/** Прочие цели и текст телефона, которых нет в раскладке линии: главы прайса. */
const PHONE_390_EXTRA = [[29, 808, 333, 163], [29, 1003, 333, 165], [29, 1200, 333, 197], [29, 1429, 333, 223]].map(box);

const DESKTOP_1440: ThreadLayout = {
  width: 1440,
  logo: box([76, 14, 113, 113]),
  call: box([1020, 22, 362, 86]),
  navLinks: [[497, 48, 67, 31], [595, 48, 79, 31], [705, 48, 100, 31], [836, 48, 106, 31]].map(box),
  masthead: box([59, 184, 1327, 237]),
  plate: box([454, 129, 533, 661]),
  tagline: box([59, 408, 361, 78]),
  services: box([60, 523, 188, 138]),
  priceHeading: box([59, 830, 164, 59]),
  pricePhotos: box([62, 1156, 1315, 412]),
  sheets: [[62, 1694, 1315, 426], [62, 2223, 1315, 494], [62, 2818, 1315, 804]].map(box),
  priceBottom: 3850,
  worksTitle: box([59, 3988, 745, 158]),
  works: [[69, 4228, 405, 550], [517, 4399, 293, 410], [854, 4010, 517, 690], [181, 4998, 293, 410], [1078, 5106, 293, 410], [629, 4912, 405, 550]].map(box),
  faqTitle: box([59, 5808, 333, 78]),
  faqList: box([508, 5801, 761, 630]),
  contactsTitle: box([59, 6750, 362, 78]),
  phone: box([59, 7032, 455, 75]),
};

/** Точки пути из абсолютных M/C (так пишет buildThread). */
function samplePath(d: string, perSegment = 24) {
  const tokens = d.match(/[MC]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: { x: number; y: number }[] = [];
  let i = 0;
  let cur = { x: 0, y: 0 };
  let moves = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const num = () => Number(tokens[i++]);
    if (cmd === "M") {
      cur = { x: num(), y: num() };
      moves++;
      points.push(cur);
    } else if (cmd === "C") {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const p = { x: num(), y: num() };
      for (let k = 1; k <= perSegment; k++) {
        const t = k / perSegment;
        const u = 1 - t;
        points.push({
          x: u * u * u * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p.x,
          y: u * u * u * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p.y,
        });
      }
      cur = p;
    } else throw new Error(`неожиданная команда пути ${cmd}`);
  }
  return { points, moves };
}

const inside = (p: { x: number; y: number }, b: Box, pad: number) =>
  p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad;

describe("сквозная линия (история R12, тикет 05)", () => {
  it("на телефоне: одна непрерывная линия от линии земли логотипа до телефона в визите", () => {
    const { d } = buildThread(PHONE_390);
    const { points, moves } = samplePath(d);
    expect(moves).toBe(1);
    const first = points[0];
    const last = points[points.length - 1];
    // линия земли под пуделем: доли области логотипа из макета (298−126)/188, (182−24)/188
    expect(first.x).toBeCloseTo(17 + 72 * (172 / 188), 0);
    expect(first.y).toBeCloseTo(12 + 72 * (158 / 188), 0);
    // конец — справа от номера, на его строке
    const phone = PHONE_390.phone;
    expect(last.x).toBeGreaterThan(phone.x + phone.w);
    expect(last.x).toBeLessThan(phone.x + phone.w + 40);
    expect(last.y).toBeGreaterThan(phone.y);
    expect(last.y).toBeLessThan(phone.y + phone.h);
  });

  it("на телефоне линия не заходит на текст и цели нажатия и не выходит за экран", () => {
    const { d } = buildThread(PHONE_390);
    const { points } = samplePath(d, 40);
    const L = PHONE_390;
    const obstacles: [string, Box, number][] = [
      ["«Записаться»", L.call!, 2],
      ...L.navLinks.map((b, i) => [`пункт меню ${i + 1}`, b, 6] as [string, Box, number]),
      ["подзаголовок", L.tagline!, 2],
      ["услуги", L.services!, 2],
      ["«Прайс»", L.priceHeading!, 2],
      ...PHONE_390_EXTRA.map((b, i) => [`глава прайса ${i + 1}`, b, 2] as [string, Box, number]),
      ["фото процедур", L.pricePhotos!, 2],
      ...L.sheets.map((b, i) => [`лист прайса ${i + 1}`, b, 2] as [string, Box, number]),
      ["заголовок работ", L.worksTitle!, 2],
      ...L.works.map((b, i) => [`кадр ${i + 1}`, b, 8] as [string, Box, number]),
      ["«Вопросы»", L.faqTitle!, 2],
      ["список вопросов", L.faqList!, 2],
      ["«Контакты»", L.contactsTitle!, 2],
      ["телефон", L.phone, 4],
    ];
    for (const p of points) {
      expect(p.x, `точка ${Math.round(p.x)},${Math.round(p.y)} за краем экрана`).toBeGreaterThanOrEqual(1);
      expect(p.x, `точка ${Math.round(p.x)},${Math.round(p.y)} за краем экрана`).toBeLessThanOrEqual(L.width - 1);
      for (const [name, b, pad] of obstacles) {
        expect(inside(p, b, pad), `линия заходит на «${name}» в ${Math.round(p.x)},${Math.round(p.y)}`).toBe(false);
      }
    }
  });

  it("на компьютере первый экран — контур утверждённого макета, дальше та же линия идёт до телефона", () => {
    const { d, heroD } = buildThread(DESKTOP_1440);
    expect(heroD).toBe(scalePath(HERO_INK_PATH, 1440 / 2400));
    expect(d.startsWith(heroD)).toBe(true);
    const { points, moves } = samplePath(d);
    expect(moves).toBe(1);
    const last = points[points.length - 1];
    const phone = DESKTOP_1440.phone;
    expect(last.x).toBeGreaterThan(phone.x + phone.w);
    expect(last.x).toBeLessThan(phone.x + phone.w + 40);
    expect(last.y).toBeGreaterThan(phone.y);
    expect(last.y).toBeLessThan(phone.y + phone.h);
  });

  it("на компьютере ниже первого экрана линия не заходит на фото, листы прайса, кадры, вопросы и контакты", () => {
    const { d, heroD } = buildThread(DESKTOP_1440);
    const L = DESKTOP_1440;
    const rest = samplePath(`M0 0${d.slice(heroD.length)}`, 40).points.slice(1);
    const obstacles: [string, Box, number][] = [
      ["фото процедур", L.pricePhotos!, 4],
      ...L.sheets.map((b, i) => [`лист прайса ${i + 1}`, b, 4] as [string, Box, number]),
      ["заголовок работ", L.worksTitle!, 4],
      ...L.works.map((b, i) => [`кадр ${i + 1}`, b, 12] as [string, Box, number]),
      ["«Вопросы»", L.faqTitle!, 4],
      ["список вопросов", L.faqList!, 4],
      ["«Контакты»", L.contactsTitle!, 4],
      ["телефон", L.phone, 6],
    ];
    const visible = rest.filter((p) => p.x <= L.width);
    expect(visible.length).toBeGreaterThan(100);
    for (const p of visible) {
      for (const [name, b, pad] of obstacles) {
        expect(inside(p, b, pad), `линия заходит на «${name}» в ${Math.round(p.x)},${Math.round(p.y)}`).toBe(false);
      }
    }
  });

  it("дорисовывается по прокрутке: доля растёт с пером и не убывает; при reduced-motion линия целиком", () => {
    // путь из 100 отсчётов по 10 px, идущий вниз от y = 0 до y = 990; первый экран — первые 300 px длины
    const lengths = Float64Array.from({ length: 100 }, (_, i) => i * 10);
    const maxY = Float64Array.from({ length: 100 }, (_, i) => i * 10);
    const samples: InkSamples = { lengths, maxY, total: 990, heroLength: 300 };

    expect(drawnFraction(samples, 0, 0, true)).toBe(1);
    expect(drawnFraction(samples, 5000, 0.2, true)).toBe(1);

    expect(drawnFraction(samples, 0, 0)).toBe(0); // шторка ещё закрыта
    expect(drawnFraction(samples, 0, 0.5)).toBeCloseTo(150 / 990); // появление первого экрана
    expect(drawnFraction(samples, 900, 0.5)).toBeCloseTo(150 / 990); // пока идёт появление — без забегания вперёд
    expect(drawnFraction(samples, 0, 1)).toBeCloseTo(300 / 990); // первый экран нарисован
    let previous = 0;
    for (let pen = 0; pen <= 1200; pen += 37) {
      const value = drawnFraction(samples, pen, 1);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(drawnFraction(samples, 600, 1)).toBeCloseTo(600 / 990);
    expect(drawnFraction(samples, 5000, 1)).toBe(1);
  });
});

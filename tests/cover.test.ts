import { describe, expect, it } from "vitest";
import { COVER_BLOCKS, COVER_H, COVER_W, GUIDE, MASTHEAD, OCCLUSION_FADE, OCCLUSION_TOP, guidePath } from "../src/components/cover/layout";
import { clampView, coverDate, coverFit, zoomAt } from "../src/components/cover/view";
import { COVER_LINES, COVER_SAMPLE_SENSATION } from "../src/data/cover";
import { COVER_SENSATIONS, pickSensation } from "../src/data/sensations";

// Обложка «Лапакюр» с питомцем посетителя: сенсации, строки о студии (факты — как в facts.md),
// геометрия рамки-подсказки и подгонка кадра. Canvas и камера в jsdom не живут — здесь чистые функции.

describe("сенсации номера", () => {
  it("15 разных кричащих фраз, первая — пример с рамки-приглашения", () => {
    expect(COVER_SENSATIONS).toHaveLength(15);
    expect(new Set(COVER_SENSATIONS).size).toBe(15);
    expect(COVER_SENSATIONS[0]).toBe(COVER_SAMPLE_SENSATION);
    expect(COVER_SENSATIONS).toContain("Лучший в шоу");
    expect(COVER_SENSATIONS).toContain("Элегантность не лает");
    for (const s of COVER_SENSATIONS) expect(s.trim().length).toBeGreaterThan(5);
  });

  it("«Другая сенсация» никогда не повторяет текущую", () => {
    for (const current of COVER_SENSATIONS) {
      for (const r of [0, 0.3, 0.6, 0.999]) expect(pickSensation(current, () => r)).not.toBe(current);
    }
    expect(COVER_SENSATIONS).toContain(pickSensation());
  });
});

describe("строки обложки о студии", () => {
  // литералы — из facts.md, а не из кода
  it("адрес, часы и телефон — дословно из фактов студии", () => {
    expect(COVER_LINES.address.sub).toEqual(["просп. 9-й Пятилетки, 15", "ежедневно 10:00–18:00"]);
    expect(COVER_LINES.booking.sub).toContain("+7 (903) 358-11-61");
    expect(COVER_LINES.services.sub[0]).toBe("Стрижка, мытьё, окраска, вычёсывание");
  });
});

describe("геометрия обложки", () => {
  /** Точки контура рамки (концы и опоры кривых): только M и C — пары x y. */
  const guidePoints = () => {
    const numbers = (guidePath().match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    return numbers.flatMap((n, i) => (i % 2 ? [[numbers[i - 1], n] as const] : []));
  };

  it("помпон пуделя в рамке-подсказке чуть заходит на шапку, но не выше линии, до которой голова может закрыть буквы", () => {
    const top = Math.min(...guidePoints().map(([, y]) => y));
    expect(top).toBeGreaterThan(OCCLUSION_TOP);
    expect(top).toBeLessThan(MASTHEAD.baseline);
    expect(GUIDE.head.y).toBeGreaterThan(MASTHEAD.baseline);
    // верхние 45 % заглавных не закрываются никогда
    expect(OCCLUSION_TOP).toBeCloseTo(MASTHEAD.capTop + MASTHEAD.capHeight * 0.45, 5);
    expect(OCCLUSION_TOP + OCCLUSION_FADE).toBeLessThan(MASTHEAD.baseline);
  });

  it("контур рамки — пудель внутри кадра 3:4, низ одной линией по нижнему краю, без отдельных лап", () => {
    const path = guidePath();
    const points = guidePoints();
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(COVER_W);
      expect(y).toBeLessThanOrEqual(COVER_H);
    }
    expect(COVER_W / COVER_H).toBeCloseTo(3 / 4, 5);
    // на нижнем крае — только начало контура и его последняя точка: замыкание Z идёт по низу одной линией
    const floor = points.filter(([, y]) => y === COVER_H);
    expect(floor).toHaveLength(2);
    expect(/^M\S+ 1440 /.test(path)).toBe(true);
    expect(/ \S+ 1440 Z$/.test(path)).toBe(true);
  });

  it("строки обложки по бокам не заходят на голову пуделя в рамке", () => {
    const head = guidePoints().filter(([, y]) => y >= COVER_BLOCKS.services.top && y <= 560);
    const left = COVER_BLOCKS.services.x + COVER_BLOCKS.services.width;
    const right = COVER_BLOCKS.address.x - COVER_BLOCKS.address.width;
    for (const [x] of head) {
      expect(x).toBeGreaterThan(left);
      expect(x).toBeLessThan(right);
    }
  });

  it("шапка — от поля до поля по краске Prata", () => {
    expect(MASTHEAD.right - MASTHEAD.left).toBe(COVER_W - 80);
    expect(MASTHEAD.size * 5.635).toBeCloseTo(MASTHEAD.right - MASTHEAD.left, 5);
  });
});

describe("подгонка кадра", () => {
  it("кадр любого формата закрывает обложку целиком", () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920], [3000, 4000], [500, 500]]) {
      const v = coverFit(w, h);
      expect(v.x).toBeLessThanOrEqual(0.0001);
      expect(v.y).toBeLessThanOrEqual(0.0001);
      expect(v.x + w * v.scale).toBeGreaterThanOrEqual(COVER_W - 0.0001);
      expect(v.y + h * v.scale).toBeGreaterThanOrEqual(COVER_H - 0.0001);
    }
  });

  it("сдвиг и масштаб не открывают края фото, увеличение не больше 4×", () => {
    const w = 3000;
    const h = 4000;
    const min = coverFit(w, h).scale;
    const far = clampView({ scale: min, x: 500, y: -99999 }, w, h);
    expect(far.x).toBe(0);
    expect(far.y + h * far.scale).toBeCloseTo(COVER_H, 5);
    expect(clampView({ scale: min / 2, x: 0, y: 0 }, w, h).scale).toBe(min);
    expect(clampView({ scale: min * 10, x: 0, y: 0 }, w, h).scale).toBeCloseTo(min * 4, 10);
  });

  it("щипок вокруг точки оставляет её под пальцем", () => {
    const view = { scale: 0.5, x: -100, y: -40 };
    const px = 300;
    const py = 700;
    const next = zoomAt(view, 1.8, px, py);
    // точка фото под пальцем до и после
    expect((px - next.x) / next.scale).toBeCloseTo((px - view.x) / view.scale, 10);
    expect((py - next.y) / next.scale).toBeCloseTo((py - view.y) / view.scale, 10);
  });

  it("дата номера — месяц и год по-русски", () => {
    expect(coverDate(new Date(2026, 9, 23))).toBe("октябрь 2026");
    expect(coverDate(new Date(2027, 0, 1))).toBe("январь 2027");
  });
});

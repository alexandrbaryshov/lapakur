// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { STUDIO } from "../src/data/studio";
import { SERVICES } from "../src/data/services";
import { PRICE_GROUPS, PRICE_CHAPTERS, type PriceCell } from "../src/data/prices";
import { REVIEWS } from "../src/data/reviews";
import { FAQ } from "../src/data/faq";
import { WORKS } from "../src/data/works";

// ── Эталон — facts.md самой свежей сборки в .autopilot/*/ (единственный источник фактов) ──
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function readFacts(): string {
  const base = join(ROOT, ".autopilot");
  const dirs = readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  for (const dir of dirs) {
    const file = join(base, dir, "facts.md");
    if (existsSync(file)) return readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  }
  throw new Error("facts.md не найден в .autopilot/*/");
}

const FACTS = readFacts();

function section(title: string): string {
  const start = FACTS.indexOf(`### ${title}`);
  if (start < 0) throw new Error(`в facts.md нет раздела «${title}»`);
  const rest = FACTS.slice(start + 4);
  const end = rest.search(/\n#{2,3} /);
  return end < 0 ? rest : rest.slice(0, end);
}

function table(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.startsWith("|"));
  const cells = (l: string) => l.split("|").slice(1, -1).map((c) => c.trim());
  return { header: cells(lines[0]), rows: lines.slice(2).map(cells) };
}

function footnotes(text: string): string[] {
  return [...text.matchAll(/^\\\* «(.+)»$/gm)].map((m) => `* ${m[1]}`);
}

function plainCell(raw: string): PriceCell {
  if (raw === "—") return null;
  expect(raw).toMatch(/^\d+$/);
  return { amount: Number(raw) };
}

type ExpectedRow = { breed: string; cells: PriceCell[]; duration?: string; hourly?: number };

function expressRows(rows: string[][]): ExpectedRow[] {
  return rows.map(([breed, time, price]) => {
    const m = price.match(/^(от )?(\d+)(?:; (\d+) — 1 час работы)?$/);
    if (!m) throw new Error(`не разобрана цена «${price}»`);
    const cell: PriceCell = m[1] ? { amount: Number(m[2]), from: true } : { amount: Number(m[2]) };
    const row: ExpectedRow = { breed, cells: [cell] };
    if (time !== "—") row.duration = time;
    if (m[3]) row.hourly = Number(m[3]);
    return row;
  });
}

function actualRows(id: string): ExpectedRow[] {
  const group = PRICE_GROUPS.find((g) => g.id === id);
  if (!group) throw new Error(`нет группы ${id}`);
  return group.rows.map((r) => {
    const row: ExpectedRow = { breed: r.breed, cells: r.cells };
    if (r.duration !== undefined) row.duration = r.duration;
    if (r.hourly !== undefined) row.hourly = r.hourly;
    return row;
  });
}

const express = section("Экспресс-линька (цены 1)");
const complexA = section("Комплекс / гигиеническая стрижка (цены 2)");
const complexB = section("Комплекс / гигиеническая стрижка (цены 3)");

describe("PRICE_GROUPS — прайс дословно по facts.md", () => {
  it("три листа в порядке страницы: комплекс ×2, экспресс-линька", () => {
    expect(PRICE_GROUPS.map((g) => g.id)).toEqual(["complex-a", "complex-b", "express-shedding"]);
  });

  it("31 строка, 44 непустые цены, сумма всех цен 100 000 ₽ (подсчитано вручную по листам)", () => {
    const rows = PRICE_GROUPS.flatMap((g) => g.rows);
    const amounts = rows.flatMap((r) => r.cells).filter((c): c is NonNullable<PriceCell> => c !== null);
    expect(rows).toHaveLength(31);
    expect(amounts).toHaveLength(44);
    expect(amounts.reduce((s, c) => s + c.amount, 0)).toBe(100_000);
  });

  it("комплекс (цены 2): каждая строка, колонки и сноска совпадают", () => {
    const t = table(complexA);
    const group = PRICE_GROUPS.find((g) => g.id === "complex-a")!;
    expect(group.columns).toEqual(t.header.slice(1));
    expect(actualRows("complex-a")).toEqual(
      t.rows.map(([breed, ...cells]) => ({ breed, cells: cells.map(plainCell) })),
    );
    expect(group.footnotes).toEqual(footnotes(complexA));
  });

  it("комплекс (цены 3): каждая строка, колонки и сноска совпадают", () => {
    const t = table(complexB);
    const group = PRICE_GROUPS.find((g) => g.id === "complex-b")!;
    expect(group.columns).toEqual(t.header.slice(1));
    expect(actualRows("complex-b")).toEqual(
      t.rows.map(([breed, ...cells]) => ({ breed, cells: cells.map(plainCell) })),
    );
    expect(group.footnotes).toEqual(footnotes(complexB));
  });

  it("экспресс-линька (цены 1): время, «от», почасовые ставки; «от 5000тысяч» читается «от 5000»", () => {
    const t = table(express);
    const group = PRICE_GROUPS.find((g) => g.id === "express-shedding")!;
    expect([group.durationLabel, ...group.columns]).toEqual(t.header.slice(1));
    expect(actualRows("express-shedding")).toEqual(expressRows(t.rows));
    expect(group.footnotes).toEqual([]);
    const senbernar = group.rows.find((r) => r.breed === "Сенбернар")!;
    expect(senbernar.cells).toEqual([{ amount: 5000, from: true }]);
  });

  it("у каждой строки столько цен, сколько колонок; у каждого листа своё фото процедуры", () => {
    for (const g of PRICE_GROUPS) {
      for (const r of g.rows) expect(r.cells).toHaveLength(g.columns.length);
    }
    const photos = PRICE_GROUPS.map((g) => g.photo);
    expect(new Set(photos).size).toBe(3);
    for (const p of photos) expect(p).toMatch(/^price-(bichon|yorkie|spitz|poodle)$/);
  });

  it("четыре главы пород из «Направления»: 2200 / 1700 / 1800 / 2200 ₽ комплекса с мытьём", () => {
    expect(
      PRICE_CHAPTERS.map((c) => [c.id, c.title, c.breed, c.column, c.price, c.photo, c.silhouette]),
    ).toEqual([
      ["bichon", "Бишон", "Бишон", "Комплекс с мытьём", { amount: 2200 }, "price-bichon", "breed-bichon"],
      ["yorkie", "Йорк", "Йорк до 5 кг", "Комплекс с мытьём", { amount: 1700 }, "price-yorkie", "breed-yorkie"],
      ["spitz", "Шпиц", "Шпиц до 5 кг с остевой шерстью", "Комплекс с мытьём", { amount: 1800 }, "price-spitz", "breed-spitz"],
      ["poodle", "Пудель", "Пудель до 28 см", "Комплекс с мытьём", { amount: 2200 }, "price-poodle", "breed-poodle"],
    ]);
  });
});

describe("REVIEWS — 5 отзывов дословно", () => {
  const expected = [...FACTS.matchAll(/^\d+\. (.+?), (\d+ \S+) — «(.+)»$/gm)].map((m) => ({
    author: m[1],
    date: m[2],
    rating: 5,
    text: m[3],
  }));

  it("в facts.md разобрано ровно 5 отзывов (страховка парсера)", () => {
    expect(expected).toHaveLength(5);
    expect(expected[2].text).toContain("вход.  Раиса");
  });

  it("автор, дата, оценка и текст символ в символ, включая эмодзи и двойные пробелы", () => {
    expect(REVIEWS).toEqual(expected);
  });
});

describe("STUDIO — контакты из facts.md", () => {
  const field = (name: string) => {
    const m = FACTS.match(new RegExp(`^- ${name}: (.+)$`, "m"));
    if (!m) throw new Error(`нет поля ${name}`);
    return m[1].trim();
  };

  it("название, город, адрес, телефон, часы", () => {
    expect(STUDIO.name).toBe("Лапакюр");
    expect(STUDIO.city).toBe("Чебоксары");
    expect(STUDIO.address).toBe(field("Адрес"));
    expect(STUDIO.phoneDisplay).toBe(field("Телефон"));
    expect(STUDIO.phoneHref).toBe(`tel:+${field("Телефон").replace(/\D/g, "")}`);
    expect(STUDIO.hours).toBe(field("Часы"));
  });

  it("координаты и организация в Яндекс Картах", () => {
    const [lat, lon] = field("Координаты").split(/[ ,]+/).map(Number);
    expect(STUDIO.geo).toEqual({ lat, lon });
    expect(STUDIO.yandexOrgId).toBe(field("ID организации"));
    expect(STUDIO.yandexOrgUrl).toBe("https://yandex.ru/maps/org/lapakyur/199810306793/");
    expect(STUDIO.yandexReviewsUrl).toBe("https://yandex.ru/maps/org/lapakyur/199810306793/reviews/");
  });
});

describe("SERVICES — пять услуг брифа", () => {
  it("стрижка, когти, мытьё, окраска, вычёсывание — без цен", () => {
    expect(SERVICES.map((s) => s.id)).toEqual(["grooming", "nails", "bath", "coloring", "deshedding"]);
    const titles = SERVICES.map((s) => s.title);
    [/стрижка/i, /когт/i, /мыт/i, /окраск/i, /вычёс/i].forEach((re, i) => expect(titles[i]).toMatch(re));
    for (const s of SERVICES) expect(Object.keys(s).sort()).toEqual(["id", "title"]);
  });
});

describe("FAQ — только факты", () => {
  const all = FAQ.map((f) => `${f.q}\n${f.a}`).join("\n\n");

  it("7–8 вопросов с уникальными id, без восклицаний и выдуманных правил", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(7);
    expect(FAQ.length).toBeLessThanOrEqual(8);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(FAQ.length);
    expect(all).not.toMatch(/!/);
    expect(all).not.toMatch(/прививк|вакцин|оплат|сертифи|присутств|опыт/i);
  });

  it("покрывает запись, адрес и часы, мытьё перед комплексом, гигиену, экспресс-линьку, крупные породы, породу вне прайса", () => {
    const answerTo = (re: RegExp) => {
      const item = FAQ.find((f) => re.test(f.q));
      if (!item) throw new Error(`нет вопроса ${re}`);
      return item.a;
    };
    expect(answerTo(/записат/i)).toContain("+7 (903) 358-11-61");
    expect(all).toContain("10:00");
    expect(all).toContain("18:00");
    expect(answerTo(/где /i)).toContain("просп. 9-й Пятилетки, 15");
    expect(answerTo(/мыть/i)).toMatch(/свежепомыт/i);
    expect(answerTo(/гигиеническ/i)).toContain("кроме стрижки корпуса (спинки)");
    const shedding = answerTo(/экспресс-линьк/i);
    expect(shedding).toContain("1 час 30 минут");
    expect(shedding).toContain("5 часов");
    const large = answerTo(/крупн/i);
    expect(large).toContain("5000");
    expect(large).toContain("1400");
    expect(answerTo(/нет в прайсе/i)).toContain("+7 (903) 358-11-61");
  });

  it("про длительность экспресс-линьки не утверждает, что время в прайсе есть у всех пород", () => {
    const shedding = FAQ.find((f) => /длится экспресс-линьк/i.test(f.q))?.a ?? "";
    // породы, у которых в листе «цены 1» время — прочерк (facts.md)
    const untimed = table(express)
      .rows.filter(([, time]) => time === "—")
      .map(([breed]) => breed.toLowerCase());
    expect(untimed).toEqual(["сенбернар", "ньюфаундленд", "бернский зенненхунд", "алабай"]);
    expect(shedding).not.toMatch(/(кажд|всех|любой)\S*\s+пород/i);
    for (const breed of untimed) expect(shedding.toLowerCase()).toContain(breed);
  });
});

describe("WORKS — 6 настоящих фото", () => {
  it("ключи works-* из interfaces.md и подписи пород из имён файлов dogs-foto-live", () => {
    expect(WORKS.map((w) => w.media)).toEqual([
      "works-cocker-black",
      "works-cocker",
      "works-bichon",
      "works-yorkie",
      "works-spitz",
      "works-poodle",
    ]);
    [/кокер-спаниель/i, /кокер-спаниель/i, /бишон/i, /йорк/i, /шпиц/i, /пудель/i].forEach((re, i) =>
      expect(WORKS[i].breed).toMatch(re),
    );
  });
});

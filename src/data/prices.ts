// Прайс студии — единственное место, где живут цены (R16.1).
// Источник — три фото прайса (prices/цены 1–3.jpg), расшифровка в facts.md.
// Правите цену — правите здесь; страница, главы пород и ответы FAQ строятся отсюда.
// «от 5000тысяч» на листе — опечатка, читается «от 5000».

import type { MediaKey } from "../media/manifest";

/** Цена в рублях; `from: true` — «от …». `null` — в прайсе для этой колонки пусто. */
export type PriceCell = { amount: number; from?: true } | null;

export type PriceRow = {
  breed: string;
  /** По одной цене на каждую колонку `PriceGroup.columns`. */
  cells: PriceCell[];
  /** Время процедуры (только экспресс-линька), дословно с листа. */
  duration?: string;
  /** Ставка за 1 час работы, ₽ («1400 — 1 час работы»). */
  hourly?: number;
  note?: string;
};

export type PriceGroupId = "complex-a" | "complex-b" | "express-shedding";

export type PriceGroup = {
  id: PriceGroupId;
  /** Заголовок листа на странице. */
  title: string;
  /** Подписи колонок цен, дословно с листа; `columns.length === row.cells.length`. */
  columns: string[];
  /** Подпись колонки времени (есть только у экспресс-линьки, стоит перед ценами). */
  durationLabel?: string;
  rows: PriceRow[];
  /** Сноски листа дословно, с маркером «* ». */
  footnotes: string[];
  /** Сгенерированное фото процедуры рядом с листом. */
  photo: MediaKey;
};

const rub = (amount: number): PriceCell => ({ amount });
const from = (amount: number): PriceCell => ({ amount, from: true });
const none: PriceCell = null;

export const PRICE_GROUPS: readonly PriceGroup[] = [
  {
    id: "complex-a",
    title: "Комплекс и гигиеническая стрижка",
    columns: ["Комплекс без мытья", "Комплекс с мытьём", "Гигиеническая стрижка*"],
    rows: [
      { breed: "Ши-тцу", cells: [rub(1800), rub(2200), rub(2000)] },
      { breed: "Пекинес", cells: [rub(1200), rub(1800), none] },
      { breed: "Бишон", cells: [rub(1700), rub(2200), rub(1900)] },
      { breed: "Мальтезе", cells: [rub(1400), rub(1700), none] },
      { breed: "Русский спаниель", cells: [rub(1200), rub(1800), rub(1500)] },
      { breed: "Американский спаниель", cells: [none, rub(2400), none] },
      { breed: "Английский спаниель", cells: [none, rub(2200), none] },
      { breed: "Длинношёрстная чихуа-хуа", cells: [none, rub(1700), none] },
    ],
    footnotes: ["* Всё что входит в комплекс, кроме стрижки корпуса (спинки)"],
    photo: "price-bichon",
  },
  {
    id: "complex-b",
    title: "Комплекс и гигиеническая стрижка: йорки, шпицы, пудели",
    columns: ["Комплекс* без мытья", "Комплекс с мытьём", "Гигиеническая стрижка (всё кроме спинки)"],
    rows: [
      { breed: "Йорк до 5 кг", cells: [rub(1400), rub(1700), rub(1500)] },
      { breed: "Йорк от 5 кг или с густой пухлявой шерстью", cells: [rub(1500), rub(1800), rub(1600)] },
      { breed: "Шпиц до 5 кг с остевой шерстью", cells: [rub(1500), rub(1800), none] },
      { breed: "Шпиц от 5 кг или с густой набивной шерстью", cells: [none, rub(1900), none] },
      { breed: "Шпиц 7–12 кг", cells: [none, rub(2000), none] },
      { breed: "Пудель до 28 см", cells: [none, rub(2200), none] },
      { breed: "Пудель до 28–35 см", cells: [none, rub(2400), none] },
      { breed: "Пудель до 35–45 см", cells: [none, rub(2800), none] },
      { breed: "Пудель от 45 см", cells: [none, rub(3500), none] },
    ],
    footnotes: [
      "* Собака должна быть СВЕЖЕПОМЫТОЙ. Особенно тщательно мыть голову, уши, лапы. (От этого зависит качество стрижки)",
    ],
    photo: "price-poodle",
  },
  {
    id: "express-shedding",
    title: "Экспресс-линька",
    durationLabel: "Время",
    columns: ["Цена, ₽"],
    rows: [
      { breed: "Бигль", duration: "1 час 30 минут", cells: [rub(2000)] },
      { breed: "Корги", duration: "2 часа 30 минут", cells: [rub(2000)] },
      { breed: "Шарпей", duration: "2 часа 15 минут", cells: [rub(2000)] },
      { breed: "Мопс", duration: "2 часа", cells: [rub(1700)] },
      { breed: "Сиба-ину", duration: "2 часа 30 минут", cells: [rub(2000)] },
      { breed: "Акита-ину", duration: "3 часа", cells: [from(3000)], hourly: 1400 },
      { breed: "Голден ретривер", duration: "3 часа 30 минут", cells: [from(2500)], hourly: 1300 },
      { breed: "Хаски", duration: "3 часа 30 минут", cells: [from(3000)], hourly: 1400 },
      { breed: "Лабрадор", duration: "2 часа 45 минут", cells: [rub(2500)] },
      { breed: "Самоед", duration: "5 часов", cells: [from(3000)], hourly: 1400 },
      { breed: "Сенбернар", cells: [from(5000)] },
      { breed: "Ньюфаундленд", cells: [from(5000)] },
      { breed: "Бернский зенненхунд", cells: [from(5000)] },
      { breed: "Алабай", cells: [from(5000)] },
    ],
    footnotes: [],
    photo: "price-spitz",
  },
];

// ── Главы пород над прайсом (раздел «Направление» спецификации) ──
// Цена главы не дублируется: она берётся из строки PRICE_GROUPS.

export type PriceChapterId = "bichon" | "yorkie" | "spitz" | "poodle";

export type PriceChapter = {
  id: PriceChapterId;
  /** Короткое имя главы: «Бишон». */
  title: string;
  /** Строка прайса, из которой взята цена, дословно. */
  breed: string;
  /** Подпись колонки, из которой взята цена. */
  column: string;
  price: PriceCell;
  groupId: PriceGroupId;
  /** Фото процедуры (бишон — стрижка ножницами, йорк — гигиеническая стрижка, шпиц — вычёсывание, пудель — мытьё). */
  photo: MediaKey;
  /** Однолинейный силуэт породы (PNG с прозрачностью). */
  silhouette: MediaKey;
};

export function findPriceRow(groupId: PriceGroupId, breed: string): PriceRow {
  const row = PRICE_GROUPS.find((g) => g.id === groupId)?.rows.find((r) => r.breed === breed);
  if (!row) throw new Error(`В прайсе нет строки «${breed}» (${groupId})`);
  return row;
}

function chapter(
  id: PriceChapterId,
  title: string,
  groupId: PriceGroupId,
  breed: string,
  column: string,
  photo: MediaKey,
  silhouette: MediaKey,
): PriceChapter {
  const group = PRICE_GROUPS.find((g) => g.id === groupId)!;
  const index = group.columns.indexOf(column);
  if (index < 0) throw new Error(`В листе ${groupId} нет колонки «${column}»`);
  return { id, title, breed, column, price: findPriceRow(groupId, breed).cells[index], groupId, photo, silhouette };
}

const WITH_BATH = "Комплекс с мытьём";

export const PRICE_CHAPTERS: readonly PriceChapter[] = [
  chapter("bichon", "Бишон", "complex-a", "Бишон", WITH_BATH, "price-bichon", "breed-bichon"),
  chapter("yorkie", "Йорк", "complex-b", "Йорк до 5 кг", WITH_BATH, "price-yorkie", "breed-yorkie"),
  chapter("spitz", "Шпиц", "complex-b", "Шпиц до 5 кг с остевой шерстью", WITH_BATH, "price-spitz", "breed-spitz"),
  chapter("poodle", "Пудель", "complex-b", "Пудель до 28 см", WITH_BATH, "price-poodle", "breed-poodle"),
];

/** «2200 ₽», «от 5000 ₽» — цифры как на листе, пробелы неразрывные; пустая ячейка — «—». */
export function formatPrice(cell: PriceCell): string {
  if (cell === null) return "—";
  return `${cell.from ? "от\u00a0" : ""}${cell.amount}\u00a0₽`;
}

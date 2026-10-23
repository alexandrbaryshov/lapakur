// Частые вопросы — ответы только из известных фактов (facts.md): запись, адрес и часы,
// сноски прайса, время и цены экспресс-линьки. Никаких правил, которых нет в фактах
// (прививки, оплата, присутствие хозяина и т. п.).
// Телефон, адрес, часы и цены не повторяются руками — берутся из studio.ts и prices.ts.

import { STUDIO } from "./studio";
import { PRICE_GROUPS, formatPrice, type PriceRow } from "./prices";

export type FaqItem = { id: string; q: string; a: string };

const expressRows = PRICE_GROUPS.find((g) => g.id === "express-shedding")?.rows ?? [];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «бигль, корги и шарпей» */
function listBreeds(rows: readonly PriceRow[]): string {
  const names = rows.map((r) => lower(r.breed));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}` : names[0];
}

function minutes(duration: string): number {
  const m = duration.match(/(\d+)\s+час\S*(?:\s+(\d+)\s+минут)?/);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : Number.NaN;
}

function sheddingDuration(): string {
  const timed = expressRows.filter((r) => r.duration !== undefined);
  // у части крупных пород в листе вместо времени прочерк — не обещаем время «для каждой»
  const untimed = expressRows.filter((r) => r.duration === undefined);
  const sorted = [...timed].sort((a, b) => minutes(a.duration!) - minutes(b.duration!));
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];
  const rest = untimed.length
    ? ` У пород ${listBreeds(untimed)} его в прайсе нет — уточняйте по телефону ${STUDIO.phoneDisplay}.`
    : "";
  return (
    `Зависит от породы: ${lower(shortest.breed)} — ${shortest.duration}, ` +
    `${lower(longest.breed)} — ${longest.duration}; время для большинства пород указано в прайсе.${rest}`
  );
}

function groupBy(rows: readonly PriceRow[], key: (r: PriceRow) => string): PriceRow[][] {
  const groups = new Map<string, PriceRow[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  return [...groups.values()];
}

function largeBreeds(): string {
  const flat = expressRows.filter((r) => r.cells[0]?.from && r.hourly === undefined);
  const hourly = expressRows.filter((r) => r.hourly !== undefined);
  const flatText = groupBy(flat, (r) => String(r.cells[0]?.amount))
    .map((g) => `${upper(listBreeds(g))} — ${formatPrice(g[0].cells[0])}.`)
    .join(" ");
  const hourlyText = groupBy(hourly, (r) => `${r.cells[0]?.amount}|${r.hourly}`)
    .map((g) => `${listBreeds(g)} — ${formatPrice(g[0].cells[0])}, час работы — ${formatPrice({ amount: g[0].hourly! })}`)
    .join("; ");
  return `${flatText} ${upper(hourlyText)}.`;
}

export const FAQ: readonly FaqItem[] = [
  {
    id: "booking",
    q: "Как записаться?",
    a: `Только по телефону: ${STUDIO.phoneDisplay}. Студия работает ${STUDIO.hours}.`,
  },
  {
    id: "location",
    q: "Где вы находитесь и когда работаете?",
    a: `Адрес: ${STUDIO.address}. Часы работы: ${STUDIO.hours}.`,
  },
  {
    id: "wash-before",
    q: "Нужно ли мыть собаку перед комплексом без мытья?",
    a: "Да. Собака должна быть свежепомытой: особенно тщательно вымойте голову, уши и лапы — от этого зависит качество стрижки.",
  },
  {
    id: "hygiene",
    q: "Чем гигиеническая стрижка отличается от комплекса?",
    a: "В гигиеническую стрижку входит всё, что входит в комплекс, кроме стрижки корпуса (спинки).",
  },
  {
    id: "shedding-duration",
    q: "Сколько длится экспресс-линька?",
    a: sheddingDuration(),
  },
  {
    id: "large-breeds",
    q: "Сколько стоит экспресс-линька для крупных пород?",
    a: largeBreeds(),
  },
  {
    id: "breed-missing",
    q: "Что делать, если моей породы нет в прайсе?",
    a: `Позвоните по номеру ${STUDIO.phoneDisplay} — стоимость для вашей собаки обсудим по телефону.`,
  },
  {
    id: "not-in-price",
    q: "Сколько стоят окраска и подстрижка когтей?",
    a: `Этих услуг нет в прайсе — стоимость уточняйте по телефону ${STUDIO.phoneDisplay}.`,
  },
];

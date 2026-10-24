// Обложка журнала «Лапакюр» с питомцем посетителя (рамка в «Ваших довольных питомцах» → камера):
// шапка ЛАПАКЮР, имя питомца главным заголовком, под ним сенсация номера (sensations.ts), по краям —
// строки обложки о студии. Факты в строках — только из studio.ts и services.ts.

import { SERVICES, type ServiceId } from "./services";
import { STUDIO } from "./studio";

/** Строка обложки: заголовок дидоном (строки как есть) и подпись гротеском (переносится по ширине). */
export type CoverLine = { head: readonly string[]; sub: readonly string[] };

const COVER_SERVICES: readonly ServiceId[] = ["grooming", "bath", "coloring", "deshedding"];
const serviceWord = (id: ServiceId) => SERVICES.find((s) => s.id === id)?.title.replace(/\s*\(.*\)$/, "") ?? "";

/** Строки обложки о студии и записи — журнальными заголовками. */
export const COVER_LINES = {
  services: {
    head: ["Премиум", "груминг"],
    sub: [
      COVER_SERVICES.map(serviceWord)
        .filter(Boolean)
        .map((word, i) => (i ? word.toLocaleLowerCase("ru") : word))
        .join(", "),
    ],
  },
  address: {
    head: ["Адрес", "стиля"],
    // «ежедневно 10:00–18:00» — без запятой: строка переносится между словом и часами
    sub: [STUDIO.address.replace(`, ${STUDIO.city}`, ""), STUDIO.hours.replace(",", "")],
  },
  booking: {
    head: ["Запись"],
    sub: ["по телефону", STUDIO.phoneDisplay],
  },
} satisfies Record<string, CoverLine>;

/** Город номера — рядом с датой под шапкой. */
export const COVER_CITY = STUDIO.city;

/** Сенсация-пример на рамке-приглашении; первая в списке сенсаций. */
export const COVER_SAMPLE_SENSATION = "Лучший в шоу";

/** Самое длинное имя питомца на обложке. */
export const PET_NAME_MAX = 16;

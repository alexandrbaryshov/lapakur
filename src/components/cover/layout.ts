// Геометрия обложки «Лапакюр» в единицах кадра 1080 × 1440 (3:4, как у журнала). Общая для
// подсказки камеры (SVG поверх видео) и для отрисовки обложки на canvas — то, что посетитель
// видит в рамке, совпадает с готовой обложкой. Чистые функции, без DOM.

export const COVER_W = 1080;
export const COVER_H = 1440;

/** Краска ЛАПАКЮР в Prata — 5,635 кегля по ширине (замер шапки страницы), заглавная — 0,794 кегля. */
export const PRATA_MASTHEAD_EM = 5.635;
export const PRATA_CAP = 0.794;

/** Шапка: от поля до поля кадра, заглавные от capTop до базовой линии. */
export const MASTHEAD = (() => {
  const left = 40;
  const right = COVER_W - 40;
  const size = (right - left) / PRATA_MASTHEAD_EM;
  const capTop = 48;
  const capHeight = size * PRATA_CAP;
  return { left, right, size, capTop, capHeight, baseline: capTop + capHeight };
})();

/**
 * Голова питомца встаёт перед шапкой только ниже этой линии (с растушёвкой OCCLUSION_FADE):
 * верхние 45 % заглавных видны всегда, даже если питомец в кадре крупнее рамки.
 */
export const OCCLUSION_TOP = MASTHEAD.capTop + MASTHEAD.capHeight * 0.45;
export const OCCLUSION_FADE = MASTHEAD.capHeight * 0.2;

type Pt = readonly [dx: number, dy: number];

/** Отступ «до низа кадра»: такие точки стоят на нижнем крае обложки. */
const BOTTOM = Infinity;

/**
 * Левая половина силуэта сидящей собаки анфас — кубические кривые от щели между передними лапами
 * к макушке; точки — [сдвиг от середины кадра, отступ от макушки]. Передняя лапа → щель до задней лапы →
 * бедро → грудь → подбородок → морда → висячее ухо-капля → купол головы. Правая половина — зеркальная.
 */
const DOG_START: Pt = [0, 1235];
const DOG_LEFT: readonly (readonly [Pt, Pt, Pt])[] = [
  [[-8, 1270], [-22, 1290], [-26, BOTTOM]], // внутренний край передней лапы
  [[-70, BOTTOM], [-110, BOTTOM], [-150, BOTTOM]], // передняя лапа по нижнему краю
  [[-150, 1220], [-158, 1165], [-182, 1160]], // внешний край передней лапы — вверх до щели
  [[-206, 1155], [-215, 1220], [-218, BOTTOM]], // щель между передней и задней лапой
  [[-270, BOTTOM], [-330, BOTTOM], [-385, BOTTOM]], // задняя лапа по нижнему краю
  [[-400, 1200], [-395, 1020], [-340, 900]], // бедро
  [[-290, 800], [-210, 720], [-170, 610]], // бок
  [[-140, 545], [-100, 492], [-66, 478]], // грудь — к шее под мордой
  [[-56, 474], [-60, 456], [-66, 440]], // подбородок
  [[-74, 410], [-88, 380], [-104, 352]], // морда
  [[-112, 336], [-118, 320], [-122, 300]], // скула — в выемку под ухом
  [[-140, 340], [-170, 420], [-210, 430]], // внутренний край висячего уха
  [[-242, 430], [-252, 330], [-246, 220]], // кончик и внешний край уха
  [[-238, 140], [-212, 84], [-180, 70]], // верх уха
  [[-160, 64], [-130, 80], [-116, 84]], // ложбинка между ухом и куполом
  [[-108, 30], [-62, 0], [0, 0]], // купол головы
];

/** Отступ от макушки, ниже которого начинается грудь: выше — голова с ушами. */
const DOG_HEAD_DEPTH = 470;

/**
 * Рамка-подсказка: силуэт собаки, макушка которой чуть заходит на нижнюю половину заглавных шапки.
 * headHalf — полуширина головы с ушами: по бокам от неё стоят строки обложки.
 */
export const GUIDE = {
  cx: COVER_W / 2,
  top: MASTHEAD.capTop + MASTHEAD.capHeight * 0.58,
  headHalf: Math.max(...DOG_LEFT.flat().filter(([, dy]) => dy < DOG_HEAD_DEPTH).map(([dx]) => -dx)),
};

/** Контур рамки-подсказки (SVG-путь): левая половина силуэта и её зеркальная копия в обратном порядке. */
export function guidePath(): string {
  const { cx, top } = GUIDE;
  const f = (n: number) => Math.round(n * 10) / 10;
  const at = ([dx, dy]: Pt, mirror = false) => `${f(cx + (mirror ? -dx : dx))} ${dy === BOTTOM ? COVER_H : f(top + dy)}`;
  const left = DOG_LEFT.map(([c1, c2, end]) => `C${at(c1)} ${at(c2)} ${at(end)}`);
  const right = DOG_LEFT.map(([c1, c2], i) => `C${at(c2, true)} ${at(c1, true)} ${at(i === 0 ? DOG_START : DOG_LEFT[i - 1][2], true)}`);
  return [`M${at(DOG_START)}`, ...left, ...right.reverse(), "Z"].join(" ");
}

/** Поля строк обложки: левая и правая колонки у краёв кадра, по бокам от головы. */
const SIDE = 44;
const COLUMN = 244;

export type TextBlock = {
  /** Край, к которому выровнен блок: x левого края (left) или правого (right). */
  x: number;
  align: "left" | "right";
  /** Наибольшая ширина строк. */
  width: number;
  /** Верх блока (растёт вниз) или низ (растёт вверх). */
  top?: number;
  bottom?: number;
};

export const COVER_BLOCKS = {
  date: { x: COVER_W - SIDE, align: "right", width: 480, top: MASTHEAD.baseline + 22 },
  services: { x: SIDE, align: "left", width: COLUMN, top: 318 },
  address: { x: COVER_W - SIDE, align: "right", width: COLUMN, top: 318 },
  star: { x: SIDE, align: "left", width: 600, bottom: 1262 },
  booking: { x: COVER_W - SIDE, align: "right", width: 330, bottom: 1392 },
} satisfies Record<string, TextBlock>;

export const BARCODE = { x: SIDE, y: 1292, w: 236, h: 100 };

/** Кегли строк обложки, px кадра. */
export const COVER_TYPE = {
  lineHead: 54,
  lineSub: 23,
  date: 23,
  starName: 150,
  starNameMin: 72,
  starSub: 30,
  starHeadline: 96,
};

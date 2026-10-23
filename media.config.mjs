// Конфиг медиа-конвейера (scripts/media.mjs → public/media/ + src/media/manifest.ts).
// Единственный источник ключей MediaKey: новый ключ добавляется сюда и в interfaces.md.
//
// Где конвейер ищет исходник ключа (в media-src/):
//   1) `src` — путь от media-src/ (строка или список кандидатов), если задан и файл есть;
//   2) иначе любой файл в media-src/ и её подпапках с именем `<ключ>.<ext>`
//      (например media-src/works/works-bichon.jpg, media-src/hero/hero-video.mp4);
//   3) `frameFrom: <видео-ключ>` — первый кадр исходника этого видео (постер = первый кадр ролика);
//      `srcFrom: <ключ>` — исходник другого ключа со своим кропом (og-image из кадра-обложки);
//   4) ничего нет — плашка-заглушка цвета мира размером `stub`; сборка не падает,
//      в манифесте у записи `stub: true`.
//
// Поля записи:
//   type     "image" | "video"
//   widths   ширины картинки; больше исходника не делаются (тогда последней идёт ширина исходника)
//   crop     { aspect: [w, h], focus?: [fx, fy] } — кадрирование до пропорции; focus 0…1 (0.5 — центр)
//   grade    пресет цветокоррекции из GRADES: "none" | "warm-editorial"
//   alpha    true — сохранить прозрачность (AVIF/WebP + PNG-фолбэк); false — залить фоном;
//            не задано — определить по исходнику
//   poster   (видео) ключ картинки-постера
//   stub     { width, height, color } — размер и цвет заглушки

/** Палитра мира для заглушек (фарфор, тёплая бумага, розовая плитка, латунь, серо-голубой, чернила). */
export const WORLD = {
  porcelain: "#F5F0E8",
  paper: "#EFE4D2",
  blush: "#E8C9C2",
  brass: "#B8975A",
  dove: "#C6D0D8",
  ink: "#1E1B18",
};

/**
 * Пресеты цветокоррекции. warm-editorial — мягкое тепло и лёгкое снижение насыщенности
 * без изменения содержания кадра: saturation — множитель насыщенности, recomb — матрица 3×3
 * (строка = выходной канал R/G/B), linear — [множитель, сдвиг] на RGB (чуть приподнятые тени).
 */
export const GRADES = {
  none: null,
  "warm-editorial": {
    saturation: 0.9,
    recomb: [
      [1.05, 0.02, 0],
      [0.01, 1.0, 0],
      [0, 0.02, 0.92],
    ],
    linear: [0.96, 6],
  },
};

/** Стандартный набор ширин srcset. */
export const IMAGE_WIDTHS = [480, 800, 1200, 1600];
const PHOTO_WIDTHS = [480, 800, 1200];

const image = (stub, extra = {}) => ({ type: "image", widths: IMAGE_WIDTHS, grade: "none", stub, ...extra });
const portrait = (color, extra = {}) =>
  image({ width: 1200, height: 1500, color }, { widths: PHOTO_WIDTHS, crop: { aspect: [4, 5] }, ...extra });
const lineArt = (size, color, widths) =>
  image({ width: size, height: size, color }, { widths, alpha: true });

export default {
  srcDir: "media-src",
  outDir: "public/media",
  manifest: "src/media/manifest.ts",
  /** Префикс путей в манифесте: страница одна и лежит в корне, base "./" — путь относительный. */
  publicPath: "media/",
  cacheFile: "node_modules/.cache/lapakur-media/cache.json",
  grades: GRADES,
  logo: { src: "logo/logo.svg", stubColor: WORLD.blush, appleTouchBackground: WORLD.porcelain },
  entries: {
    // ── первый экран ──
    "hero-poster": image(
      { width: 1600, height: 2000, color: WORLD.blush },
      { crop: { aspect: [4, 5] }, frameFrom: "hero-video" },
    ),
    "hero-video": {
      type: "video",
      poster: "hero-poster",
      stub: { width: 720, height: 900, color: WORLD.blush, seconds: 2 },
    },
    // Маска шапки ЛАПАКЮР за тюрбаном (тикет F3, G02): альфа = видимость верхнего слоя шапки над пластиной,
    // 0 — тюрбан и голова (буква уходит за них), 255 — плитка. Кадр маски — пластина шириной W с полем 8/1200 W
    // вокруг, высота 752/1200 W от верха (полоса шапки). Силуэт снят с постера и всех кадров петли по цвету
    // (полотенце, шерсть, очки), союз медианы кадров и постера, запас −1 px и мягкий край 4 px на 1200 px W.
    // Без исходника — непрозрачная плашка: шапка целиком поверх пластины, как до F3.
    "hero-mask": image({ width: 1216, height: 752, color: WORLD.ink }, { widths: [608], alpha: true }),
    curtain: image({ width: 1200, height: 1600, color: WORLD.blush }),
    "curtain-rod": image({ width: 1600, height: 120, color: WORLD.brass }, { widths: [800, 1600], alpha: true }),
    "call-dog": lineArt(480, WORLD.dove, [160, 320, 480]),

    // ── прайс: однолинейные силуэты пород и фото процедур ──
    "breed-bichon": lineArt(480, WORLD.dove, [240, 480]),
    "breed-yorkie": lineArt(480, WORLD.dove, [240, 480]),
    "breed-spitz": lineArt(480, WORLD.dove, [240, 480]),
    "breed-poodle": lineArt(480, WORLD.dove, [240, 480]),
    // фото процедур чистые; «винтаж» (тепло, лёгкое зерно) добавляет пресет — interfaces.md, таск 02
    "price-bichon": portrait(WORLD.paper, { grade: "warm-editorial" }),
    "price-yorkie": portrait(WORLD.paper, { grade: "warm-editorial" }),
    "price-spitz": portrait(WORLD.paper, { grade: "warm-editorial" }),
    "price-poodle": portrait(WORLD.paper, { grade: "warm-editorial" }),

    // ── настоящие работы студии: только кадрирование и мягкий общий тон ──
    "works-cocker-black": portrait(WORLD.dove, { grade: "warm-editorial" }),
    "works-cocker": portrait(WORLD.dove, { grade: "warm-editorial" }),
    "works-bichon": portrait(WORLD.dove, { grade: "warm-editorial" }),
    "works-yorkie": portrait(WORLD.dove, { grade: "warm-editorial" }),
    "works-spitz": portrait(WORLD.dove, { grade: "warm-editorial" }),
    "works-poodle": portrait(WORLD.dove, { grade: "warm-editorial" }),

    // ── превью ссылки (Open Graph) ──
    "og-image": image(
      { width: 1200, height: 630, color: WORLD.blush },
      { widths: [1200], crop: { aspect: [1200, 630], focus: [0.5, 0.4] }, srcFrom: "hero-poster" },
    ),
  },
};

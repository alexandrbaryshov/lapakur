import { m, useReducedMotion, type Variants } from "motion/react";
import { PRICE_CHAPTERS, formatPrice } from "../data/prices";
import { Picture } from "./Picture";
import { ZOOM_SPRING } from "./zoom";
import styles from "./PriceChapters.module.css";

// Начало прайса, которое видно уже на первом экране макета: «ПРАЙС» и четыре главы пород
// с однолинейными силуэтами и главной строкой цены. Цены и подписи — только из PRICE_CHAPTERS
// (в макете цифры были выдуманы). Весь прайс и фото процедур достраивает секция Prices (таск 04).

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export type PriceChaptersProps = {
  /** id заголовка «Прайс» — для aria-labelledby секции #price. */
  headingId?: string;
  className?: string;
};

/** Наведение и нажатие на главу приближают силуэт породы (R30): пружина, как у фото и кнопок. */
const silhouetteZoom: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 1.05 },
};

export function PriceChapters({ headingId = "price-title", className }: PriceChaptersProps) {
  const reduceMotion = useReducedMotion();
  // tabIndex −1: жест нажатия Motion иначе сделал бы строку списка фокусируемой с клавиатуры
  const gestures = reduceMotion
    ? {}
    : ({ initial: "rest", animate: "rest", whileHover: "hover", whileTap: "tap", tabIndex: -1 } as const);
  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <h2 id={headingId} className={styles.heading}>
        Прайс
      </h2>
      <ol className={styles.chapters}>
        {PRICE_CHAPTERS.map((chapter) => (
          <m.li key={chapter.id} className={styles.chapter} data-chapter={chapter.id} {...gestures}>
            <h3 className={styles.name}>{chapter.title}</h3>
            <m.div
              className={styles.silhouette}
              variants={reduceMotion ? undefined : silhouetteZoom}
              transition={ZOOM_SPRING}
            >
              <Picture
                media={chapter.silhouette}
                sizes="(min-width: 900px) 13vw, 120px"
                alt=""
                imgClassName={styles.silhouetteImg}
              />
            </m.div>
            <p className={styles.row}>
              <span>
                {/* на телефоне имя главы стоит прямо над строкой — в строке остаётся колонка прайса */}
                <span className={styles.rowBreed}>{chapter.title} · </span>
                <span className={styles.rowColumn}>{lower(chapter.column)}</span>
              </span>
              <span className={styles.price}>{formatPrice(chapter.price)}</span>
            </p>
            {chapter.breed !== chapter.title && (
              <p className={styles.note}>Цена по строке прайса «{chapter.breed}»</p>
            )}
          </m.li>
        ))}
      </ol>
    </div>
  );
}

import { m, useReducedMotion, type Variants } from "motion/react";
import { STUDIO } from "../data/studio";
import { Picture } from "./Picture";
import styles from "./CallButton.module.css";

// «Записаться» — это звонок: записаться можно только по телефону (бриф), поэтому кнопка —
// ссылка tel: с однолинейной собакой у дискового телефона (пластина call-dog).

export type CallButtonProps = {
  /** hero — в шапке обложки; compact — липкая кнопка на телефоне; inline — внутри текста. */
  variant: "hero" | "compact" | "inline";
  /** Показать номер рядом с подписью (виден на ширине ≥ 1024 px, у inline — всегда). */
  showNumber?: boolean;
  className?: string;
};

/** «+7 903 358-11-61» — номер из STUDIO без скобок, как в макете. */
export const PHONE_SHORT = STUDIO.phoneDisplay.replace(/[()]/g, "");

const DOG_SIZES: Record<CallButtonProps["variant"], string> = {
  hero: "(min-width: 900px) 6vw, 48px",
  compact: "44px",
  inline: "32px",
};

/** Приближение по наведению и нажатию (R30): оба жеста приближают, нажатие — чуть сильнее. */
const dogMotion: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.04 },
  tap: { scale: 1.05 },
};

export function CallButton({ variant, showNumber = false, className }: CallButtonProps) {
  const reduceMotion = useReducedMotion();
  const gestures = reduceMotion ? {} : { initial: "rest", animate: "rest", whileHover: "hover", whileTap: "tap" };

  return (
    <m.a
      href={STUDIO.phoneHref}
      className={[styles.call, styles[variant], className].filter(Boolean).join(" ")}
      data-call={variant}
      {...gestures}
    >
      <span className={styles.label}>Записаться</span>
      <span className="visually-hidden"> по телефону </span>
      <m.span
        className={styles.dog}
        variants={reduceMotion ? undefined : dogMotion}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        aria-hidden="true"
      >
        <Picture media="call-dog" sizes={DOG_SIZES[variant]} alt="" imgClassName={styles.dogImg} />
      </m.span>
      <span className={showNumber ? styles.number : "visually-hidden"}>{PHONE_SHORT}</span>
    </m.a>
  );
}

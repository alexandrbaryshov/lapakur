import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Picture } from "../components/Picture";
import { useZoom } from "../components/zoom";
import type { Work } from "../data/works";
import styles from "./Lightbox.module.css";

// Просмотр фото крупнее (spec.md, история 21): фото на фарфоре в той же рамке, подпись породы.
// Закрывают Esc, крестик и нажатие вне фото; фокус — на крестике, после закрытия Works
// возвращает его на кадр. Страница под просмотром не прокручивается.
// Рендерится только на клиенте и только после первого открытия (lazy в Works).

export type LightboxProps = {
  /** Открытое фото; null — просмотр закрыт (с анимацией ухода). */
  work: Work | null;
  onClose: () => void;
};

export function Lightbox({ work, onClose }: LightboxProps) {
  const reduceMotion = useReducedMotion();
  const zoom = useZoom(1.05);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = work !== null;

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        // в просмотре одна кнопка — фокус остаётся на ней
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previous;
    };
  }, [open, onClose]);

  /** Нажатие где угодно, кроме самого фото, закрывает просмотр. */
  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLImageElement)) onClose();
  };

  const fade = { duration: reduceMotion ? 0.15 : 0.32, ease: [0.16, 1, 0.3, 1] as const };

  return createPortal(
    <AnimatePresence>
      {work && (
        <m.div
          key="lightbox"
          className={styles.backdrop}
          role="dialog"
          aria-modal="true"
          aria-label={work.breed}
          onClick={onBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <m.figure
            className={styles.figure}
            initial={reduceMotion ? false : { scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduceMotion ? undefined : { scale: 0.98, y: 6 }}
            transition={fade}
          >
            <div className={styles.frame}>
              <Picture
                media={work.media}
                sizes="(min-width: 900px) 600px, 92vw"
                alt={`${work.breed} после груминга в студии`}
                imgClassName={styles.img}
                priority
              />
            </div>
            <figcaption className={styles.caption}>{work.breed}</figcaption>
          </m.figure>
          <m.button ref={closeRef} type="button" className={styles.close} onClick={onClose} {...zoom}>
            <span className={styles.cross} aria-hidden="true" />
            <span className="visually-hidden">Закрыть</span>
          </m.button>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

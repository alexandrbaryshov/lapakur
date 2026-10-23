import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { PriceGroup } from "../data/prices";
import { CallButton } from "./CallButton";
import { PriceTable } from "./PriceTable";
import { useZoom } from "./zoom";
import styles from "./PriceSheetDialog.module.css";

// Окно листа прайса (spec.md, история 38): лист тёплой бумаги над страницей — заголовок, полная
// ведомость, сноски дословно и «Записаться». Закрывают крестик, Esc и нажатие вне листа; фокус —
// в окне (на крестике) и не выходит из него по Tab; после закрытия Prices возвращает его на карточку.
// Страница под окном не прокручивается; на телефоне окно во весь экран, ведомость прокручивается внутри.
// Рендерится только на клиенте и только после первого открытия (lazy в Prices), как просмотр фото.

export type PriceSheetDialogProps = {
  /** Открытый лист; null — окно закрыто (с анимацией ухода). */
  group: PriceGroup | null;
  onClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PriceSheetDialog({ group, onClose }: PriceSheetDialogProps) {
  const reduceMotion = useReducedMotion();
  const zoom = useZoom(1.05);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = group !== null;

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    // полоса прокрутки уходит — её место держит отступ, страница под окном не сдвигается
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.paddingRight;
    };
  }, [open, onClose]);

  /** Нажатие на подложку вокруг листа закрывает окно; внутри листа — нет. */
  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const ease = [0.16, 1, 0.3, 1] as const;
  const titleId = group ? `price-dialog-${group.id}` : undefined;

  return createPortal(
    <AnimatePresence>
      {group && (
        <m.div
          key="price-sheet"
          className={styles.backdrop}
          data-sheet-backdrop
          onClick={onBackdrop}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.32, ease }}
        >
          <m.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-sheet-dialog={group.id}
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            transition={{ duration: 0.42, ease }}
          >
            <header className={styles.head}>
              <h2 id={titleId} className={styles.title}>
                {group.title}
              </h2>
              <m.button ref={closeRef} type="button" className={styles.close} onClick={onClose} {...zoom}>
                <span className={styles.cross} aria-hidden="true" />
                <span className="visually-hidden">Закрыть</span>
              </m.button>
            </header>
            {/* прокручиваемая ведомость доступна с клавиатуры (стрелки, PageDown) */}
            <div className={styles.body} tabIndex={0} role="region" aria-labelledby={titleId}>
              <PriceTable group={group} labelledBy={titleId!} />
              {group.footnotes.length > 0 && (
                <div className={styles.notes}>
                  {group.footnotes.map((note) => (
                    <p key={note} className={styles.note}>
                      {note}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <footer className={styles.foot}>
              <CallButton variant="inline" showNumber className={styles.call} />
            </footer>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

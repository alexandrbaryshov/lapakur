import { m } from "motion/react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Picture } from "../components/Picture";
import { useZoom } from "../components/zoom";
import { WORKS, type Work } from "../data/works";
import type { MediaKey } from "../media";
import { CoverInvite } from "./CoverInvite";
import styles from "./Works.module.css";

// «Наши довольные питомцы» — фотоэссе из шести настоящих работ студии (spec.md, истории 20–21):
// рамки разного размера вразбежку, подпись породы, почти без текста. Нажатие открывает фото
// крупнее (Lightbox — отдельным чанком, грузится при первом открытии). Последней в эссе стоит
// рамка-приглашение: сфотографировать своего питомца на обложку журнала (CoverStudio — тоже чанком).

const Lightbox = lazy(() => import("./Lightbox").then((module) => ({ default: module.Lightbox })));
const CoverStudio = lazy(() => import("./CoverStudio").then((module) => ({ default: module.CoverStudio })));

/**
 * Порядок и место кадров в эссе. На компьютере у каждого кадра своя клетка сетки
 * (Works.module.css, data-slot); на телефоне — две колонки, «wide» — во всю ширину.
 */
const ESSAY: readonly { media: MediaKey; slot: string; wide?: true; desktopVw: number }[] = [
  { media: "works-bichon", slot: "bichon", desktopVw: 30 },
  { media: "works-yorkie", slot: "yorkie", desktopVw: 22 },
  { media: "works-poodle", slot: "poodle", wide: true, desktopVw: 37 },
  { media: "works-cocker", slot: "cocker", desktopVw: 22 },
  { media: "works-cocker-black", slot: "cocker-black", desktopVw: 22 },
  { media: "works-spitz", slot: "spitz", wide: true, desktopVw: 30 },
];

/** Ширина кадра в вёрстке: на компьютере — его колонки эссе, на телефоне — половина или вся ширина. */
const sizesFor = (wide: boolean, desktopVw: number) => `(min-width: 900px) ${desktopVw}vw, ${wide ? 92 : 46}vw`;

type FrameProps = { work: Work; wide: boolean; slot: string; sizes: string; onOpen: (el: HTMLButtonElement) => void };

function Frame({ work, wide, slot, sizes, onOpen }: FrameProps) {
  const zoom = useZoom(1.03);
  return (
    <figure className={styles.item} data-slot={slot} data-wide={wide || undefined}>
      <m.button
        type="button"
        className={styles.frame}
        aria-haspopup="dialog"
        aria-label={`Открыть крупнее: ${work.breed}`}
        onClick={(event) => onOpen(event.currentTarget)}
        {...zoom}
      >
        <Picture
          media={work.media}
          sizes={sizes}
          alt={`${work.breed} после груминга в студии`}
          className={styles.picture}
          imgClassName={styles.img}
        />
      </m.button>
      <figcaption className={styles.caption}>{work.breed}</figcaption>
    </figure>
  );
}

export function Works() {
  const [active, setActive] = useState<Work | null>(null);
  const [requested, setRequested] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const open = useCallback((work: Work, el: HTMLButtonElement) => {
    trigger.current = el;
    setRequested(true);
    setActive(work);
  }, []);

  const close = useCallback(() => {
    setActive(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  const [coverOpen, setCoverOpen] = useState(false);
  const [coverRequested, setCoverRequested] = useState(false);

  const openCover = useCallback((el: HTMLButtonElement) => {
    trigger.current = el;
    setCoverRequested(true);
    setCoverOpen(true);
  }, []);

  const closeCover = useCallback(() => {
    setCoverOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section id="works" aria-labelledby="works-title" className={styles.section}>
      <div className={styles.essay}>
        <h2 id="works-title" className={styles.title}>
          Наши довольные питомцы
        </h2>
        {ESSAY.map(({ media, slot, wide, desktopVw }) => {
          const work = WORKS.find((w) => w.media === media);
          if (!work) return null;
          return (
            <Frame
              key={media}
              work={work}
              slot={slot}
              wide={Boolean(wide)}
              sizes={sizesFor(Boolean(wide), desktopVw)}
              onOpen={(el) => open(work, el)}
            />
          );
        })}
        <CoverInvite onOpen={openCover} />
      </div>
      {requested && (
        <Suspense fallback={null}>
          <Lightbox work={active} onClose={close} />
        </Suspense>
      )}
      {coverRequested && (
        <Suspense fallback={null}>
          <CoverStudio open={coverOpen} onClose={closeCover} />
        </Suspense>
      )}
    </section>
  );
}

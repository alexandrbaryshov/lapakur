import { m } from "motion/react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Picture } from "../components/Picture";
import { useZoom } from "../components/zoom";
import { ALBUMS, type Work } from "../data/works";

import { CoverInvite } from "./CoverInvite";
import styles from "./Works.module.css";

// «Ваши довольные питомцы» — фотоэссе из шести настоящих работ студии (spec.md, истории 20–21):
// рамки разного размера вразбежку, подпись породы, почти без текста. Нажатие открывает фото
// крупнее (Lightbox — отдельным чанком, грузится при первом открытии). Последней в эссе стоит
// рамка-приглашение: сфотографировать своего питомца на обложку журнала (CoverStudio — тоже чанком).

const Lightbox = lazy(() => import("./Lightbox").then((module) => ({ default: module.Lightbox })));
const CoverStudio = lazy(() => import("./CoverStudio").then((module) => ({ default: module.CoverStudio })));

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
        {work.src ? <img src={work.src} alt={work.breed} className={styles.img} loading="lazy" /> : (<Picture
          media={work.media}
          sizes={sizes}
          alt={`${work.breed} после груминга в студии`}
          className={styles.picture}
          imgClassName={styles.img}
        />)}
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
          Ваши довольные питомцы
        </h2>
        <div className={styles.albums}>{ALBUMS.map(album => <details key={album.title} className={styles.album}><summary>{album.title}<span>{album.works.length} фото</span></summary><div className={styles.albumPhotos}>{album.works.map(work => <Frame key={work.src ?? work.media} work={work} slot="album" wide={false} sizes="(min-width: 900px) 28vw, 44vw" onOpen={el => open(work, el)} />)}</div></details>)}</div>
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

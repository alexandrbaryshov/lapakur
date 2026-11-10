import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Picture } from "../components/Picture";
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
  return (
    <figure className={styles.item} data-slot={slot} data-wide={wide || undefined}>
      <button
        type="button"
        className={styles.frame}
        aria-haspopup="dialog"
        aria-label={`Открыть крупнее: ${work.breed}`}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        {work.src ? <img src={work.src} srcSet={work.srcSet} sizes={sizes} width={work.width} height={work.height} alt={work.breed} className={styles.img} loading="lazy" decoding="async" /> : (<Picture
          media={work.media}
          sizes={sizes}
          alt={`${work.breed} после груминга в студии`}
          className={styles.picture}
          imgClassName={styles.img}
        />)}
      </button>
      <figcaption className={styles.caption}>{work.breed}</figcaption>
    </figure>
  );
}

export function Works() {
  const section = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      for (const album of ALBUMS) for (const work of album.works.slice(0, 3)) {
        if (!work.src) continue;
        const image = new Image();
        image.sizes = '(min-width: 900px) 28vw, 44vw';
        if (work.srcSet) image.srcset = work.srcSet;
        image.src = work.src;
      }
      observer.disconnect();
    }, { rootMargin: '600px' });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
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
    <section ref={section} id="works" aria-labelledby="works-title" className={styles.section}>
      <div className={styles.essay}>
        <h2 id="works-title" className={styles.title}>
          Ваши довольные питомцы
        </h2>
        <div className={styles.albums}>{ALBUMS.map(album => <details key={album.title} className={styles.album}><summary>{album.title}<span>{album.works.length} фото</span></summary><div className={styles.albumPhotos}>{album.works.map(work => <Frame key={work.src ?? work.media} work={work} slot="album" wide={false} sizes="(min-width: 900px) 28vw, 44vw" onOpen={el => open(work, el)} />)}</div><button type="button" className={styles.collapse} onClick={event => { const details = event.currentTarget.closest("details"); if (!details) return; details.open = false; const summary = details.querySelector("summary"); summary?.focus({ preventScroll: true }); summary?.scrollIntoView({ block: "nearest" }); }}>Свернуть</button></details>)}</div>
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

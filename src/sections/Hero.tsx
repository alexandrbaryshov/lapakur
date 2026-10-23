import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Picture } from "../components/Picture";
import { SERVICES } from "../data/services";
import { STUDIO } from "../data/studio";
import { getImage, getVideo } from "../media";
import styles from "./Hero.module.css";

// Обложка журнала по утверждённому макету «Ателье одной линии»: шапка ЛАПАКЮР дидоном,
// по центру — вертикальная пластина 4:5 с петлёй «собака в спа», слева подзаголовок.
// Постер (hero-poster) грузится с первым экраном; видео подключается после события load
// и только без Save-Data и reduced-motion (spec.md, истории 4–6, 32).
//
// Голова в тюрбане — впереди шапки, как в макете (G02): шапка в два слоя. Заголовок h1 лежит под
// пластиной (виден вне её), копия для глаза — над пластиной с маской hero-mask: маска непрозрачна
// над плиткой и прозрачна на тюрбане и голове, а за краем пластины копии нет. Тюрбан в полосе букв
// за всю петлю сдвигается не больше чем на 0,5 % ширины пластины, поэтому маска одна, статичная —
// эффект есть и на постере, и без JS, и при reduced-motion.

/** Маска верхнего слоя шапки — PNG из конвейера медиа (альфа; в манифесте — srcset «url 608w»). */
const MASTHEAD_MASK = `url(${getImage("hero-mask").fallback.split(/\s+/)[0]})`;
const FRONT_MASK_STYLE: CSSProperties = { WebkitMaskImage: MASTHEAD_MASK, maskImage: MASTHEAD_MASK };

const POSTER_ALT =
  "Рыжий кудрявый пудель в тюрбане из полотенца и очках «кошачий глаз» лежит в розовой ванне, " +
  "читает книгу «Лапакюр», рядом бокал розового вина";

/**
 * Пластина — 37 % ширины на компьютере; на телефоне ~70 % ширины, но при DPR ≥ 2,5 — 266 px,
 * чтобы телефону доставалось не шире 800w (бюджет первого экрана).
 */
const POSTER_SIZES =
  "(max-width: 899px) and (min-resolution: 2.5dppx) 266px, (max-width: 899px) 70vw, 37vw";

type Connection = Navigator & { connection?: { saveData?: boolean } };

function canPlayVideo() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const saveData = (navigator as Connection).connection?.saveData ?? false;
  return !reduced && !saveData;
}

function useAfterLoad() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") {
      const id = window.setTimeout(() => setLoaded(true), 0);
      return () => window.clearTimeout(id);
    }
    const onLoad = () => setLoaded(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return loaded;
}

function HeroVideo() {
  const video = getVideo("hero-video");
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // Петля играет, только пока обложка видна: за пределами экрана — пауза.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => {});
      else el.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={styles.video}
      data-playing={playing || undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
      onPlaying={() => setPlaying(true)}
    >
      <source media="(max-width: 767px)" src={video.mobile.webm} type="video/webm" />
      <source media="(max-width: 767px)" src={video.mobile.mp4} type="video/mp4" />
      <source src={video.desktop.webm} type="video/webm" />
      <source src={video.desktop.mp4} type="video/mp4" />
    </video>
  );
}

export function Hero() {
  const loaded = useAfterLoad();
  const [video, setVideo] = useState(false);

  useEffect(() => {
    if (loaded && canPlayVideo()) setVideo(true);
  }, [loaded]);

  return (
    <section id="top" className={styles.hero} aria-labelledby="top-title">
      <figure className={styles.plate}>
        <Picture media="hero-poster" priority sizes={POSTER_SIZES} alt={POSTER_ALT} imgClassName={styles.poster} />
        {video && <HeroVideo />}
      </figure>

      <h1 id="top-title" className={styles.masthead} data-masthead="back" tabIndex={-1}>
        {STUDIO.name}
      </h1>
      <div className={`${styles.masthead} ${styles.front}`} data-masthead="front" aria-hidden="true" style={FRONT_MASK_STYLE}>
        {STUDIO.name}
      </div>

      <p className={styles.tagline}>
        Премиум-студия <br className={styles.break} />
        груминга в Чебоксарах
      </p>

      <ul className={styles.services} aria-label="Услуги студии">
        {SERVICES.map((service) => (
          <li key={service.id} className={styles.service}>
            {service.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

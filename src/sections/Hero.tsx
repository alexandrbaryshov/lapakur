import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Picture } from "../components/Picture";
import { SERVICES } from "../data/services";
import { STUDIO } from "../data/studio";
import { getImage, getVideo } from "../media";
import styles from "./Hero.module.css";

// Обложка журнала по утверждённому макету «Ателье одной линии»: шапка ЛАПАКЮР дидоном,
// по центру — вертикальная пластина 4:5 с петлёй «собака в спа», слева подзаголовок.
// Постер (hero-poster) грузится с первым экраном; видео подключается после события load, а под шторкой
// первого захода — сразу за постером (useVideoTime), и только без Save-Data и reduced-motion
// (spec.md, истории 4–6, 32).
//
// Голова в тюрбане — впереди шапки, как в макете (G02): шапка в два слоя. Заголовок h1 лежит под
// пластиной (виден вне её), копия для глаза — над пластиной с маской hero-mask: маска непрозрачна
// над плиткой и прозрачна на тюрбане и голове, а за краем пластины копии нет. Тюрбан в полосе букв
// за всю петлю сдвигается не больше чем на 0,5 % ширины пластины, поэтому маска одна, статичная —
// эффект есть и на постере, и без JS, и при reduced-motion.
//
// Пластина — в рамке-намётке, как кадры «Ваших довольных питомцев»: волосок чернилами на отступе,
// в полосе букв шапки рамка разорвана и названия не пересекает (Hero.module.css, .frame).

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

/** Какую версию петли грузить: телефонную (480p) или компьютерную (720p). */
type VideoSize = "mobile" | "desktop";

function canPlayVideo() {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const saveData = (navigator as Connection).connection?.saveData ?? false;
  return !reduced && !saveData;
}

/**
 * Версия петли выбирается здесь, а не атрибутом media у <source>: WebKit (Safari, все браузеры iPhone)
 * пропускает <source media>, пока у вставленного видео нет рендерера, — телефон получал компьютерный WebM,
 * который мог и не заиграть.
 */
function videoSize(): VideoSize {
  return window.matchMedia?.("(max-width: 767px)").matches ? "mobile" : "desktop";
}

/**
 * Когда подключать петлю. Обычно — после load: первый экран получает всю полосу (spec.md, история 32).
 * Первый заход со шторкой (покров <html data-curtain="pending"> ставит скрипт в <head>): обложка под
 * шторкой не видна, а посетитель ещё смотрит на шторку — эти секунды отдаём петле. Она грузится, как
 * только страница ожила и пришёл постер, не дожидаясь load: его на медленной сети держит любая отставшая
 * мелочь (картинка карниза, шрифт). Картинки ниже первого экрана под шторкой не грузятся вовсе
 * (Prices, PriceChapters, Works — *.module.css), полосу делят только чанки шторки и видео.
 */
function useVideoTime(plate: RefObject<HTMLElement | null>) {
  const [time, setTime] = useState(false);
  useEffect(() => {
    const go = () => setTime(true);
    const poster =
      document.documentElement.getAttribute("data-curtain") === "pending" ? plate.current?.querySelector("img") : null;
    if (document.readyState === "complete" || poster?.complete) {
      const id = window.setTimeout(go, 0);
      return () => window.clearTimeout(id);
    }
    window.addEventListener("load", go, { once: true });
    poster?.addEventListener("load", go, { once: true });
    poster?.addEventListener("error", go, { once: true });
    return () => {
      window.removeEventListener("load", go);
      poster?.removeEventListener("load", go);
      poster?.removeEventListener("error", go);
    };
  }, [plate]);
  return time;
}

function HeroVideo({ size }: { size: VideoSize }) {
  const files = getVideo("hero-video")[size];
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
      {/* MP4 (H.264) первым: его играют все браузеры и он легче WebM; WebM — запасной */}
      <source src={files.mp4} type="video/mp4" />
      <source src={files.webm} type="video/webm" />
    </video>
  );
}

export function Hero() {
  const plate = useRef<HTMLElement>(null);
  const time = useVideoTime(plate);
  const [video, setVideo] = useState<VideoSize | null>(null);

  useEffect(() => {
    if (time && canPlayVideo()) setVideo(videoSize());
  }, [time]);

  return (
    <section id="top" className={styles.hero} aria-labelledby="top-title">
      <div className={styles.frame} data-plate-frame aria-hidden="true" />
      <figure ref={plate} className={styles.plate}>
        <Picture media="hero-poster" priority sizes={POSTER_SIZES} alt={POSTER_ALT} imgClassName={styles.poster} />
        {video && <HeroVideo size={video} />}
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

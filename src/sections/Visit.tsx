import { SocialLinks } from "../components/SocialLinks";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CallButton } from "../components/CallButton";
import { useZoom } from "../components/zoom";
import { REVIEWS } from "../data/reviews";
import { STUDIO } from "../data/studio";
import styles from "./Visit.module.css";

// Визит — финал страницы (spec.md, истории 23–26): крупный телефон, адрес и часы, маршрут в Яндекс Картах
// от места, где сейчас посетитель, карта и реальные отзывы. Карта грузится после монтирования;
// при ошибке остаётся заглушка с адресом и ссылкой.

const LL = `${STUDIO.geo.lon},${STUDIO.geo.lat}`;

/** Виджет Яндекс Карт без API-ключа: центр и метка по координатам, карточка организации по oid. */
export const YANDEX_MAP_SRC =
  "https://yandex.ru/map-widget/v1/?" +
  `ll=${encodeURIComponent(LL)}&z=16&oid=${STUDIO.yandexOrgId}&ol=biz&pt=${encodeURIComponent(`${LL},pm2pnm`)}`;

/** Сколько ждать загрузки виджета, прежде чем убрать его и оставить заглушку. */
export const MAP_TIMEOUT_MS = 25_000;

type MapState = "idle" | "loading" | "ready" | "failed";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;


function YandexMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>("idle");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const zoom = useZoom(1.03);

  // Start after mounting so the external map can load while visitors browse the page.
  useEffect(() => {
    setState(navigator.onLine === false ? "failed" : "loading");
  }, []);

  // Пока виджет грузится, он прозрачен и под ним видна заглушка. Сервер недоступен
  // или виджет так и не загрузился — iframe убирается, заглушка остаётся.
  useEffect(() => {
    if (state !== "loading") return;
    const id = window.setTimeout(() => setState((current) => (current === "loading" ? "failed" : current)), MAP_TIMEOUT_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "loading") return;
    if (frameLoaded) setState("ready");
  }, [state, frameLoaded]);

  const ready = state === "ready";
  return (
    <div ref={ref} className={styles.map} data-map={state}>
      <div className={styles.fallback} inert={ready || undefined} aria-hidden={ready || undefined}>
        <span className={styles.pin} aria-hidden="true" />
        <div className={styles.legend}>
          <p className={styles.fallbackAddress}>{STUDIO.address}</p>
          <m.a href={STUDIO.yandexOrgUrl} className={styles.fallbackLink} {...EXTERNAL} {...zoom}>
            Открыть в Яндекс Картах
          </m.a>
        </div>
      </div>
      {(state === "loading" || ready) && (
        <iframe
          className={styles.frame}
          src={YANDEX_MAP_SRC}
          title={`${STUDIO.name} на Яндекс Картах: ${STUDIO.address}`}
          loading="eager"
          allowFullScreen
          onLoad={() => setFrameLoaded(true)}
          onError={() => setState("failed")}
          data-ready={ready || undefined}
        />
      )}
    </div>
  );
}

export function Visit() {
  const parkingDialog = useRef<HTMLDialogElement>(null);
  const reviewsRef = useRef<HTMLUListElement>(null);
  const moveReviews = (direction: number) => {
    const list = reviewsRef.current;
    const card = list?.querySelector("li");
    if (list && card) list.scrollBy({ left: direction * (card.getBoundingClientRect().width + 24), behavior: "smooth" });
  };
  const zoom = useZoom(1.03);
  return (
    <section id="contacts" aria-labelledby="contacts-title" className={styles.section}>
      <div className={styles.grid}>
        <h2 id="contacts-title" className={styles.title}>
          Контакты
        </h2>

        <div className={styles.contacts}>
          <m.a href={STUDIO.phoneHref} className={styles.phone} {...zoom}>
            {STUDIO.phoneDisplay}
          </m.a>
          <CallButton variant="inline" className={styles.call} />
          <p className={styles.addressLine}>
            <a href={STUDIO.yandexOrgUrl} className={styles.address} {...EXTERNAL}>
              {STUDIO.address}
            </a>
          </p>
          <p className={styles.hours}>{STUDIO.hours}</p>
          <m.a href={STUDIO.yandexRouteUrl} className={styles.route} {...EXTERNAL} {...zoom}>
            Построить маршрут<span className="visually-hidden"> в&nbsp;Яндекс Картах</span>
          </m.a>
        </div>

        <div className={styles.mapGroup}>
          <YandexMap />
          <figure className={styles.parking}>
            <button type="button" onClick={() => parkingDialog.current?.showModal()} aria-label="Увеличить фото парковки"><img src={"./parking.webp"} alt="Место для парковки рядом со студией" loading="lazy" /></button>
            <figcaption>Припарковаться можно перед знаком, запрещающим остановку, на протяжении 40 метров, не загораживая выезд со двора.</figcaption>
          </figure>
          <dialog ref={parkingDialog} className={styles.parkingDialog} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
            <button type="button" onClick={() => parkingDialog.current?.close()} aria-label="Закрыть фото">×</button>
            <img src={"./parking.webp"} alt="Место для парковки рядом со студией" loading="lazy" />
          </dialog>
        </div>

        <div className={styles.reviews}>
          <div className={styles.reviewsHead}>
            <h3 className={styles.reviewsTitle}>Отзывы</h3>
            <m.a href={STUDIO.yandexReviewsUrl} className={styles.allReviews} {...EXTERNAL} {...zoom}>
              Все отзывы на Яндекс Картах
            </m.a>
          </div>
          <div className={styles.reviewControls}><span>Листайте, чтобы увидеть больше</span><div><button type="button" onClick={() => moveReviews(-1)} aria-label="Предыдущий отзыв">←</button><button type="button" onClick={() => moveReviews(1)} aria-label="Следующий отзыв">→</button></div></div>
          <ul ref={reviewsRef} className={styles.quotes} aria-label="Отзывы клиентов">
            {REVIEWS.map((review) => (
              <li key={`${review.author}-${review.date}`} className={styles.quoteItem}>
                <figure className={styles.quote}>
                  <blockquote className={styles.quoteText}>
                    <p>{review.text}</p>
                  </blockquote>
                  <figcaption className={styles.quoteBy}>
                    <span className={styles.author}>{review.author}</span>
                    <span className="visually-hidden">, </span>
                    <span className={styles.date}>{review.date}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.follow}><p>Подписывайтесь и следите за актуальными новостями</p><SocialLinks /></div>
      </div>
    </section>
  );
}

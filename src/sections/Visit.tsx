import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CallButton } from "../components/CallButton";
import { useZoom } from "../components/zoom";
import { REVIEWS } from "../data/reviews";
import { STUDIO } from "../data/studio";
import styles from "./Visit.module.css";

// Визит — финал страницы (spec.md, истории 23–26): крупный телефон, адрес и часы, маршрут в Яндекс Картах
// от места, где сейчас посетитель, Яндекс Карта с точкой студии и пять настоящих отзывов дословно. Виджет карты подключается, только когда
// секция близко; не загрузился — остаётся заглушка в стиле страницы с адресом и ссылкой.

const LL = `${STUDIO.geo.lon},${STUDIO.geo.lat}`;

/** Виджет Яндекс Карт без API-ключа: центр и метка по координатам, карточка организации по oid. */
export const YANDEX_MAP_SRC =
  "https://yandex.ru/map-widget/v1/?" +
  `ll=${encodeURIComponent(LL)}&z=16&oid=${STUDIO.yandexOrgId}&ol=biz&pt=${encodeURIComponent(`${LL},pm2pnm`)}`;

/** Сколько ждать загрузки виджета, прежде чем убрать его и оставить заглушку. */
export const MAP_TIMEOUT_MS = 25_000;

/**
 * Достижим ли сервер карт. Чужой iframe не сообщает об ошибке: при обрыве сети браузер
 * всё равно шлёт load — со своей страницей ошибки. Поэтому рядом с виджетом — лёгкий
 * HEAD-запрос без CORS: отклонён — сеть или блокировщик не пускают, остаётся заглушка.
 */
function probeMapHost(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve(false);
  if (typeof fetch !== "function") return Promise.resolve(true);
  return fetch(YANDEX_MAP_SRC, { method: "HEAD", mode: "no-cors", cache: "no-store", credentials: "omit" }).then(
    () => true,
    () => false,
  );
}

type MapState = "idle" | "loading" | "ready" | "failed";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

function YandexMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>("idle");
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const zoom = useZoom(1.03);

  // Виджет — только когда секция в 600 px от экрана (R21): до этого ни запроса, ни iframe.
  useEffect(() => {
    const el = ref.current;
    // без IntersectionObserver (очень старый браузер) виджет не грузим — видна заглушка
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState((current) => (current === "idle" ? "loading" : current));
        io.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Пока виджет грузится, он прозрачен и под ним видна заглушка. Сервер недоступен
  // или виджет так и не загрузился — iframe убирается, заглушка остаётся.
  useEffect(() => {
    if (state !== "loading") return;
    let alive = true;
    probeMapHost().then((ok) => {
      if (alive) setReachable(ok);
    });
    const id = window.setTimeout(() => setState((current) => (current === "loading" ? "failed" : current)), MAP_TIMEOUT_MS);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [state]);

  useEffect(() => {
    if (state !== "loading") return;
    if (reachable === false) setState("failed");
    else if (reachable && frameLoaded) setState("ready");
  }, [state, reachable, frameLoaded]);

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
          loading="lazy"
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

        <YandexMap />

        <div className={styles.reviews}>
          <div className={styles.reviewsHead}>
            <h3 className={styles.reviewsTitle}>Отзывы</h3>
            <m.a href={STUDIO.yandexReviewsUrl} className={styles.allReviews} {...EXTERNAL} {...zoom}>
              Все отзывы на Яндекс Картах
            </m.a>
          </div>
          <ul className={styles.quotes}>
            {REVIEWS.map((review, i) => (
              <li key={`${review.author}-${review.date}`} className={styles.quoteItem} data-lead={i === 0 || undefined}>
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
      </div>
    </section>
  );
}

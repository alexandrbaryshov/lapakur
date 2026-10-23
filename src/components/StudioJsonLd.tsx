import { STUDIO } from "../data/studio";

// Разметка для поисковиков (spec.md, история 36): LocalBusiness только из фактов студии
// (src/data/studio.ts ← facts.md). Ни рейтингов, ни цен, ни соцсетей — их нет в фактах
// или они не про организацию. Пререндер кладёт скрипт в HTML; на клиенте он не меняется.

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** «ежедневно, 10:00–18:00» → ["10:00", "18:00"]. */
function hoursRange(hours: string): [string, string] {
  const m = /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/.exec(hours);
  if (!m) throw new Error(`Не разобрать часы работы «${hours}»`);
  return [m[1], m[2]];
}

/** «просп. 9-й Пятилетки, 15, Чебоксары» → улица с домом без города. */
function streetAddress(address: string, city: string): string {
  return address.replace(new RegExp(`,\\s*${city}$`), "");
}

export function studioJsonLd() {
  const [opens, closes] = hoursRange(STUDIO.hours);
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: STUDIO.name,
    telephone: STUDIO.phoneHref.replace(/^tel:/, ""),
    address: {
      "@type": "PostalAddress",
      streetAddress: streetAddress(STUDIO.address, STUDIO.city),
      addressLocality: STUDIO.city,
    },
    geo: { "@type": "GeoCoordinates", latitude: STUDIO.geo.lat, longitude: STUDIO.geo.lon },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: WEEK, opens, closes }],
    hasMap: STUDIO.yandexOrgUrl,
  };
}

/** `<script type="application/ld+json">`; «<» экранирован, чтобы текст не закрыл тег. */
export function StudioJsonLd() {
  const json = JSON.stringify(studioJsonLd()).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

// Контакты студии — дословно из facts.md (Яндекс Карты, организация 199810306793).
// Сайтов и соцсетей у студии нет; запись — только по телефону.

const YANDEX_ORG_URL = "https://yandex.ru/maps/org/lapakyur/199810306793/";
const GEO = { lat: 56.097437, lon: 47.280633 } as const;

export const STUDIO = {
  name: "Лапакюр",
  city: "Чебоксары",
  phoneDisplay: "+7 (903) 358-11-61",
  phoneHref: "tel:+79033581161",
  address: "просп. 9-й Пятилетки, 15, Чебоксары",
  hours: "ежедневно, 10:00–18:00",
  geo: GEO,
  yandexOrgId: "199810306793",
  yandexOrgUrl: YANDEX_ORG_URL,
  yandexReviewsUrl: `${YANDEX_ORG_URL}reviews/`,
  /** Маршрут до студии на машине; начало маршрута не задано — Яндекс Карты ведут от того места, где сейчас посетитель. */
  yandexRouteUrl: `https://yandex.ru/maps/?rtext=~${GEO.lat},${GEO.lon}&rtt=auto`,
} as const;

export type Studio = typeof STUDIO;

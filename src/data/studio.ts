// Контакты студии — дословно из facts.md (Яндекс Карты, организация 199810306793).
// Сайтов и соцсетей у студии нет; запись — только по телефону.

const YANDEX_ORG_URL = "https://yandex.ru/maps/org/lapakyur/199810306793/";

export const STUDIO = {
  name: "Лапакюр",
  city: "Чебоксары",
  phoneDisplay: "+7 (903) 358-11-61",
  phoneHref: "tel:+79033581161",
  address: "просп. 9-й Пятилетки, 15, Чебоксары",
  hours: "ежедневно, 10:00–18:00",
  geo: { lat: 56.097437, lon: 47.280633 },
  yandexOrgId: "199810306793",
  yandexOrgUrl: YANDEX_ORG_URL,
  yandexReviewsUrl: `${YANDEX_ORG_URL}reviews/`,
} as const;

export type Studio = typeof STUDIO;

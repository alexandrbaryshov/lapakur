// Настоящие фото работ студии (dogs-foto-live/), подписи — породы из имён файлов.
// В media-src/works/ лежат копии без изменений; конвейер только кадрирует
// и мягко выравнивает тон (пресет warm-editorial).

import type { MediaKey } from "../media/manifest";

export type Work = { media: MediaKey; breed: string; src?: string; srcSet?: string; fullSrc?: string; width?: number; height?: number };

export const WORKS: readonly Work[] = [
  { media: "works-yorkie", breed: "Йоркширский терьер" },
  { media: "works-cocker-black", breed: "Английский кокер-спаниель" },
  { media: "works-cocker", breed: "Английский кокер-спаниель" },
  { media: "works-bichon", breed: "Бишон-фризе" },
  { media: "works-spitz", breed: "Померанский шпиц" },
  { media: "works-poodle", breed: "Пудель" },
];

export const ALBUMS: { title: string; works: Work[] }[] = [
  {
    "title": "Йорки",
    "works": [
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — азиатский стиль",
        "src": "./media/albums/yorkies/01-640.webp",
        "srcSet": "./media/albums/yorkies/01-320.webp 320w, ./media/albums/yorkies/01-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/01-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Бивер-терьер — короткая стрижка",
        "src": "./media/albums/yorkies/02-640.webp",
        "srcSet": "./media/albums/yorkies/02-320.webp 320w, ./media/albums/yorkies/02-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/02-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — выразительный контур",
        "src": "./media/albums/yorkies/03-640.webp",
        "srcSet": "./media/albums/yorkies/03-320.webp 320w, ./media/albums/yorkies/03-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/03-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — классика",
        "src": "./media/albums/yorkies/04-640.webp",
        "srcSet": "./media/albums/yorkies/04-320.webp 320w, ./media/albums/yorkies/04-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/04-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — круглая голова",
        "src": "./media/albums/yorkies/05-640.webp",
        "srcSet": "./media/albums/yorkies/05-320.webp 320w, ./media/albums/yorkies/05-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/05-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — короткая стрижка",
        "src": "./media/albums/yorkies/06-640.webp",
        "srcSet": "./media/albums/yorkies/06-320.webp 320w, ./media/albums/yorkies/06-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/06-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — длинная шерсть",
        "src": "./media/albums/yorkies/07-640.webp",
        "srcSet": "./media/albums/yorkies/07-320.webp 320w, ./media/albums/yorkies/07-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/07-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — светлая мордочка",
        "src": "./media/albums/yorkies/08-640.webp",
        "srcSet": "./media/albums/yorkies/08-320.webp 320w, ./media/albums/yorkies/08-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/08-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — длинные пряди",
        "src": "./media/albums/yorkies/09-640.webp",
        "srcSet": "./media/albums/yorkies/09-320.webp 320w, ./media/albums/yorkies/09-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/09-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — аккуратные ушки",
        "src": "./media/albums/yorkies/10-640.webp",
        "srcSet": "./media/albums/yorkies/10-320.webp 320w, ./media/albums/yorkies/10-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/10-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-yorkie",
        "breed": "Йоркширский терьер — портрет",
        "src": "./media/albums/yorkies/11-640.webp",
        "srcSet": "./media/albums/yorkies/11-320.webp 320w, ./media/albums/yorkies/11-640.webp 640w",
        "fullSrc": "./media/albums/yorkies/11-1200.webp",
        "width": 588,
        "height": 718
      }
    ]
  },
  {
    "title": "Шпицы",
    "works": [
      {
        "media": "works-spitz",
        "breed": "Шпиц — белый окрас",
        "src": "./media/albums/spitz/01-640.webp",
        "srcSet": "./media/albums/spitz/01-320.webp 320w, ./media/albums/spitz/01-640.webp 640w",
        "fullSrc": "./media/albums/spitz/01-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — рыжий окрас, пушистый воротник",
        "src": "./media/albums/spitz/02-640.webp",
        "srcSet": "./media/albums/spitz/02-320.webp 320w, ./media/albums/spitz/02-640.webp 640w",
        "fullSrc": "./media/albums/spitz/02-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — рыжий окрас, округлый силуэт",
        "src": "./media/albums/spitz/03-640.webp",
        "srcSet": "./media/albums/spitz/03-320.webp 320w, ./media/albums/spitz/03-640.webp 640w",
        "fullSrc": "./media/albums/spitz/03-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — белый окрас, портрет",
        "src": "./media/albums/spitz/04-640.webp",
        "srcSet": "./media/albums/spitz/04-320.webp 320w, ./media/albums/spitz/04-640.webp 640w",
        "fullSrc": "./media/albums/spitz/04-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — золотистая шерсть",
        "src": "./media/albums/spitz/05-640.webp",
        "srcSet": "./media/albums/spitz/05-320.webp 320w, ./media/albums/spitz/05-640.webp 640w",
        "fullSrc": "./media/albums/spitz/05-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — объёмный воротник",
        "src": "./media/albums/spitz/06-640.webp",
        "srcSet": "./media/albums/spitz/06-320.webp 320w, ./media/albums/spitz/06-640.webp 640w",
        "fullSrc": "./media/albums/spitz/06-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — серо-кремовая шерсть",
        "src": "./media/albums/spitz/07-640.webp",
        "srcSet": "./media/albums/spitz/07-320.webp 320w, ./media/albums/spitz/07-640.webp 640w",
        "fullSrc": "./media/albums/spitz/07-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-spitz",
        "breed": "Шпиц — рыжий окрас, после ухода",
        "src": "./media/albums/spitz/08-640.webp",
        "srcSet": "./media/albums/spitz/08-320.webp 320w, ./media/albums/spitz/08-640.webp 640w",
        "fullSrc": "./media/albums/spitz/08-1200.webp",
        "width": 580,
        "height": 691
      }
    ]
  },
  {
    "title": "Да-пудели/мальтипу",
    "works": [
      {
        "media": "works-poodle",
        "breed": "Пудель — округлая мордочка",
        "src": "./media/albums/poodles/01-640.webp",
        "srcSet": "./media/albums/poodles/01-320.webp 320w, ./media/albums/poodles/01-640.webp 640w",
        "fullSrc": "./media/albums/poodles/01-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — яркие акценты на ушах",
        "src": "./media/albums/poodles/02-640.webp",
        "srcSet": "./media/albums/poodles/02-320.webp 320w, ./media/albums/poodles/02-640.webp 640w",
        "fullSrc": "./media/albums/poodles/02-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — выставочный силуэт",
        "src": "./media/albums/poodles/03-640.webp",
        "srcSet": "./media/albums/poodles/03-320.webp 320w, ./media/albums/poodles/03-640.webp 640w",
        "fullSrc": "./media/albums/poodles/03-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Мальтипу — светлый окрас",
        "src": "./media/albums/poodles/04-640.webp",
        "srcSet": "./media/albums/poodles/04-320.webp 320w, ./media/albums/poodles/04-640.webp 640w",
        "fullSrc": "./media/albums/poodles/04-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Мальтипу — абрикосовый окрас",
        "src": "./media/albums/poodles/05-640.webp",
        "srcSet": "./media/albums/poodles/05-320.webp 320w, ./media/albums/poodles/05-640.webp 640w",
        "fullSrc": "./media/albums/poodles/05-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — рыжий окрас",
        "src": "./media/albums/poodles/06-640.webp",
        "srcSet": "./media/albums/poodles/06-320.webp 320w, ./media/albums/poodles/06-640.webp 640w",
        "fullSrc": "./media/albums/poodles/06-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — чёрный окрас, объёмные уши",
        "src": "./media/albums/poodles/07-640.webp",
        "srcSet": "./media/albums/poodles/07-320.webp 320w, ./media/albums/poodles/07-640.webp 640w",
        "fullSrc": "./media/albums/poodles/07-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — оформленные лапы",
        "src": "./media/albums/poodles/08-640.webp",
        "srcSet": "./media/albums/poodles/08-320.webp 320w, ./media/albums/poodles/08-640.webp 640w",
        "fullSrc": "./media/albums/poodles/08-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — шоколадный окрас, портрет",
        "src": "./media/albums/poodles/09-640.webp",
        "srcSet": "./media/albums/poodles/09-320.webp 320w, ./media/albums/poodles/09-640.webp 640w",
        "fullSrc": "./media/albums/poodles/09-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — чёрный окрас, короткий корпус",
        "src": "./media/albums/poodles/10-640.webp",
        "srcSet": "./media/albums/poodles/10-320.webp 320w, ./media/albums/poodles/10-640.webp 640w",
        "fullSrc": "./media/albums/poodles/10-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — собранная макушка",
        "src": "./media/albums/poodles/11-640.webp",
        "srcSet": "./media/albums/poodles/11-320.webp 320w, ./media/albums/poodles/11-640.webp 640w",
        "fullSrc": "./media/albums/poodles/11-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-poodle",
        "breed": "Пудель — округлый силуэт",
        "src": "./media/albums/poodles/12-640.webp",
        "srcSet": "./media/albums/poodles/12-320.webp 320w, ./media/albums/poodles/12-640.webp 640w",
        "fullSrc": "./media/albums/poodles/12-1200.webp",
        "width": 578,
        "height": 752
      }
    ]
  },
  {
    "title": "Спаниэли/ши тцу",
    "works": [
      {
        "media": "works-cocker",
        "breed": "Кокер-спаниель — чёрный окрас",
        "src": "./media/albums/spaniels/01-640.webp",
        "srcSet": "./media/albums/spaniels/01-320.webp 320w, ./media/albums/spaniels/01-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/01-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Кокер-спаниель — чёрный окрас, портрет",
        "src": "./media/albums/spaniels/02-640.webp",
        "srcSet": "./media/albums/spaniels/02-320.webp 320w, ./media/albums/spaniels/02-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/02-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Ши-тцу — чёрный окрас",
        "src": "./media/albums/spaniels/03-640.webp",
        "srcSet": "./media/albums/spaniels/03-320.webp 320w, ./media/albums/spaniels/03-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/03-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Американский кокер-спаниель — светлый окрас",
        "src": "./media/albums/spaniels/04-640.webp",
        "srcSet": "./media/albums/spaniels/04-320.webp 320w, ./media/albums/spaniels/04-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/04-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Кокер-спаниель — рыжий окрас",
        "src": "./media/albums/spaniels/05-640.webp",
        "srcSet": "./media/albums/spaniels/05-320.webp 320w, ./media/albums/spaniels/05-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/05-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Ши-тцу — округлая мордочка",
        "src": "./media/albums/spaniels/06-640.webp",
        "srcSet": "./media/albums/spaniels/06-320.webp 320w, ./media/albums/spaniels/06-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/06-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Кокер-спаниель — чёрный окрас, короткая стрижка",
        "src": "./media/albums/spaniels/07-640.webp",
        "srcSet": "./media/albums/spaniels/07-320.webp 320w, ./media/albums/spaniels/07-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/07-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Кокер-спаниель — чёрный окрас, длинные уши",
        "src": "./media/albums/spaniels/08-640.webp",
        "srcSet": "./media/albums/spaniels/08-320.webp 320w, ./media/albums/spaniels/08-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/08-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-cocker",
        "breed": "Спаниель — чёрно-подпалый окрас",
        "src": "./media/albums/spaniels/09-640.webp",
        "srcSet": "./media/albums/spaniels/09-320.webp 320w, ./media/albums/spaniels/09-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/09-1200.webp",
        "width": 578,
        "height": 689
      },
      {
        "media": "works-cocker",
        "breed": "Спаниель — рыжий окрас, после ухода",
        "src": "./media/albums/spaniels/10-640.webp",
        "srcSet": "./media/albums/spaniels/10-320.webp 320w, ./media/albums/spaniels/10-640.webp 640w",
        "fullSrc": "./media/albums/spaniels/10-1200.webp",
        "width": 581,
        "height": 692
      }
    ]
  },
  {
    "title": "Кошки",
    "works": [
      {
        "media": "works-bichon",
        "breed": "Мейн-кун — рыжий окрас",
        "src": "./media/albums/cats/01-640.webp",
        "srcSet": "./media/albums/cats/01-320.webp 320w, ./media/albums/cats/01-640.webp 640w",
        "fullSrc": "./media/albums/cats/01-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-bichon",
        "breed": "Домашняя длинношёрстная — трёхцветный окрас",
        "src": "./media/albums/cats/02-640.webp",
        "srcSet": "./media/albums/cats/02-320.webp 320w, ./media/albums/cats/02-640.webp 640w",
        "fullSrc": "./media/albums/cats/02-1200.webp",
        "width": 1440,
        "height": 1920
      },
      {
        "media": "works-bichon",
        "breed": "Британская короткошёрстная — голубой окрас",
        "src": "./media/albums/cats/03-640.webp",
        "srcSet": "./media/albums/cats/03-320.webp 320w, ./media/albums/cats/03-640.webp 640w",
        "fullSrc": "./media/albums/cats/03-1200.webp",
        "width": 1440,
        "height": 1920
      }
    ]
  }
];

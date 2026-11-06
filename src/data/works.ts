// Настоящие фото работ студии (dogs-foto-live/), подписи — породы из имён файлов.
// В media-src/works/ лежат копии без изменений; конвейер только кадрирует
// и мягко выравнивает тон (пресет warm-editorial).

import type { MediaKey } from "../media/manifest";

export type Work = { media: MediaKey; breed: string; src?: string };

export const WORKS: readonly Work[] = [
  { media: "works-cocker-black", breed: "Английский кокер-спаниель" },
  { media: "works-cocker", breed: "Английский кокер-спаниель" },
  { media: "works-bichon", breed: "Бишон-фризе" },
  { media: "works-yorkie", breed: "Йоркширский терьер" },
  { media: "works-spitz", breed: "Померанский шпиц" },
  { media: "works-poodle", breed: "Пудель" },
];

export const ALBUMS = [{"title":"Йорки","works":[{"media":"works-yorkie","breed":"Йорк-в Азиатском стиле 1","src":"./media/albums/yorkies/1.webp"},{"media":"works-yorkie","breed":"Йорк-в Азиатском стиле","src":"./media/albums/yorkies/2.webp"},{"media":"works-yorkie","breed":"Йорк-выделенный круг","src":"./media/albums/yorkies/3.webp"},{"media":"works-yorkie","breed":"Йорк-классика","src":"./media/albums/yorkies/4.webp"},{"media":"works-yorkie","breed":"Йорк-классическая круглая голова","src":"./media/albums/yorkies/5.webp"}]},{"title":"Шпицы","works":[{"media":"works-spitz","breed":"Померанский шпиц"}]},{"title":"Пудели","works":[{"media":"works-poodle","breed":"Пудель -в азитском стил","src":"./media/albums/poodles/1.webp"},{"media":"works-poodle","breed":"Пудель-классика","src":"./media/albums/poodles/2.webp"},{"media":"works-poodle","breed":"Пудель-на выставку","src":"./media/albums/poodles/3.webp"}]},{"title":"Спаниели","works":[{"media":"works-cocker","breed":"Английский кокер-спаниель"},{"media":"works-cocker-black","breed":"Английский кокер-спаниель"}]}] as {title: string; works: Work[]}[];

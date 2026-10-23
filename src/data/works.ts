// Настоящие фото работ студии (dogs-foto-live/), подписи — породы из имён файлов.
// В media-src/works/ лежат копии без изменений; конвейер только кадрирует
// и мягко выравнивает тон (пресет warm-editorial).

import type { MediaKey } from "../media/manifest";

export type Work = { media: MediaKey; breed: string };

export const WORKS: readonly Work[] = [
  { media: "works-cocker-black", breed: "Английский кокер-спаниель" },
  { media: "works-cocker", breed: "Английский кокер-спаниель" },
  { media: "works-bichon", breed: "Бишон-фризе" },
  { media: "works-yorkie", breed: "Йоркширский терьер" },
  { media: "works-spitz", breed: "Померанский шпиц" },
  { media: "works-poodle", breed: "Пудель" },
];

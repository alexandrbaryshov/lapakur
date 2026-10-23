// Форма записей манифеста медиа (interfaces.md → «Медиа — конвейер и манифест»).
// Сам манифест (src/media/manifest.ts) пишет scripts/media.mjs — руками не правится.

import type { MediaKey } from "./manifest";

export type ImageAsset = {
  kind: "image";
  /** Размер самой широкой версии, px. */
  width: number;
  height: number;
  /** true — есть прозрачность: фолбэк PNG вместо JPEG. */
  alpha: boolean;
  /** Готовые srcset-строки: "media/key-480.avif 480w, media/key-800.avif 800w, …". */
  avif: string;
  webp: string;
  /** JPEG, или PNG при alpha. */
  fallback: string;
  /** data-URI ≤ 1 КБ (размытое превью) или цвет "#RRGGBB" (у заглушек). */
  placeholder: string;
  /** Исходника нет — это плашка-заглушка цвета мира. */
  stub?: true;
};

export type VideoAsset = {
  kind: "video";
  /** Ключ картинки-постера (первый кадр ролика). */
  poster: MediaKey;
  /** Не выше 720p, без звука, ≤ 3 МБ. */
  desktop: { mp4: string; webm: string };
  /** Не выше 480p, без звука, ≤ 1,2 МБ. */
  mobile: { mp4: string; webm: string };
  /** Размер десктопной версии, px. */
  width: number;
  height: number;
  stub?: true;
};

export type MediaAsset = ImageAsset | VideoAsset;

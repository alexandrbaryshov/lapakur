// Доступ к манифесту медиа с проверкой вида записи.

import { MEDIA, type MediaKey } from "./manifest";
import type { ImageAsset, VideoAsset } from "./types";

export { MEDIA, MEDIA_KEYS, type MediaKey } from "./manifest";
export type { ImageAsset, VideoAsset, MediaAsset } from "./types";

export function getImage(key: MediaKey): ImageAsset {
  const asset = MEDIA[key];
  if (asset.kind !== "image") throw new Error(`Медиа «${key}» — не картинка`);
  return asset;
}

export function getVideo(key: MediaKey): VideoAsset {
  const asset = MEDIA[key];
  if (asset.kind !== "video") throw new Error(`Медиа «${key}» — не видео`);
  return asset;
}

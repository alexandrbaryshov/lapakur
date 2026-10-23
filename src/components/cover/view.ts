import { COVER_H, COVER_W } from "./layout";

// Кадр обложки из фото: масштаб и сдвиг в единицах обложки, подгонка пальцами, дата номера.
// Отдельно от layout.ts — едет в ленивом чанке камеры, а не в JS первого экрана. Чистые функции.

export type View = { scale: number; x: number; y: number };

/** Масштаб и сдвиг, при которых кадр источника w × h закрывает обложку (как object-fit: cover). */
export function coverFit(w: number, h: number): View {
  const scale = Math.max(COVER_W / w, COVER_H / h);
  return { scale, x: (COVER_W - w * scale) / 2, y: (COVER_H - h * scale) / 2 };
}

/** Ограничивает сдвиг и масштаб так, чтобы фото w × h не открывало края обложки. */
export function clampView(view: View, w: number, h: number, maxZoom = 4): View {
  const min = coverFit(w, h).scale;
  const scale = Math.min(Math.max(view.scale, min), min * maxZoom);
  const x = Math.min(0, Math.max(COVER_W - w * scale, view.x));
  const y = Math.min(0, Math.max(COVER_H - h * scale, view.y));
  return { scale, x, y };
}

/** Масштаб вокруг точки (px, py) обложки: точка под пальцем остаётся на месте. */
export function zoomAt(view: View, factor: number, px: number, py: number): View {
  const scale = view.scale * factor;
  return { scale, x: px - (px - view.x) * factor, y: py - (py - view.y) * factor };
}

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** Дата номера: «октябрь 2026» (заглавными — при отрисовке). */
export function coverDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

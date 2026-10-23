import { useReducedMotion, type Transition } from "motion/react";

// Приближение по наведению и нажатию (spec.md, история 29; R30): фото, кнопки и ссылки
// слегка приближаются на пружине — на тач-экранах по нажатию. При reduced-motion — ничего.
// Для компонентов `m.*` (LazyMotion): `<m.button {...useZoom()} />`.

export const ZOOM_SPRING: Transition = { type: "spring", stiffness: 380, damping: 28, mass: 0.7 };

export type ZoomGestures = {
  whileHover?: { scale: number };
  whileTap?: { scale: number };
  transition?: Transition;
};

/** Жесты приближения; `scale` ≈ 1.03–1.05. */
export function useZoom(scale = 1.03): ZoomGestures {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return {};
  return { whileHover: { scale }, whileTap: { scale: Math.min(scale + 0.01, 1.05) }, transition: ZOOM_SPRING };
}

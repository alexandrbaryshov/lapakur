// Логика шторки — чистые функции, без DOM (interfaces.md → «Компоненты», spec.md истории 7–12).
// Компонент Curtain только переводит жесты в события и анимирует сдвиг к цели, которую выбрал редьюсер.

/** Доля ширины экрана, после которой отпущенная шторка открывается до конца (≈ треть, R09.1). */
export const OPEN_THRESHOLD = 0.35;

/**
 * Скорость смахивания в долях ширины экрана за секунду: быстрее вправо — открыть, быстрее влево — вернуть.
 * 0,6 ширины/с — это ~230 px/с на телефоне 390 px и ~860 px/с на 1440 px: уверенный бросок, не дрожь пальца.
 */
export const FLING_VELOCITY = 0.6;

/**
 * Окно скорости отпускания, мс: в скорость идут только движения за это время до pointerup.
 * Протянул, замер дольше окна и отпустил — скорость 0, решает порог OPEN_THRESHOLD.
 */
export const VELOCITY_WINDOW_MS = 100;

/** Отметка жеста: `t` — время события (Event.timeStamp, мс), `p` — сдвиг в долях ширины. */
export type DragSample = { t: number; p: number };

/** Скорость отпускания в долях ширины за секунду — по отметкам за VELOCITY_WINDOW_MS до отпускания. */
export function releaseVelocity(samples: readonly DragSample[], release: DragSample): number {
  const from = release.t - VELOCITY_WINDOW_MS;
  const first = samples.find((s) => s.t >= from && s.t <= release.t) ?? release;
  const dt = (release.t - first.t) / 1000;
  return dt > 0.008 ? (release.p - first.p) / dt : 0;
}

/** Ключ sessionStorage: шторку уже показывали в этой вкладке (R09.2). */
export const CURTAIN_SESSION_KEY = "lapakur:curtain-shown";

export type CurtainPhase = "closed" | "dragging" | "opening" | "open";

/** `progress` — сдвиг шторки вправо в долях ширины: 0 — закрыта, 1 — ушла за край. */
export type CurtainState = { phase: CurtainPhase; progress: number };

export type CurtainEvent =
  | { type: "dragStart" }
  | { type: "dragMove"; progress: number }
  | { type: "release"; progress: number; velocity: number }
  | { type: "openRequest" }
  | { type: "settled" };

export const initialCurtainState: CurtainState = { phase: "closed", progress: 0 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function curtainReducer(state: CurtainState, event: CurtainEvent): CurtainState {
  switch (event.type) {
    case "dragStart":
      return state.phase === "closed" ? { phase: "dragging", progress: state.progress } : state;

    case "dragMove":
      return state.phase === "dragging" ? { phase: "dragging", progress: clamp01(event.progress) } : state;

    case "release": {
      if (state.phase !== "dragging") return state;
      const progress = clamp01(event.progress);
      if (event.velocity <= -FLING_VELOCITY) return { phase: "closed", progress: 0 };
      if (event.velocity >= FLING_VELOCITY || progress >= OPEN_THRESHOLD) return { phase: "opening", progress };
      return { phase: "closed", progress: 0 };
    }

    case "openRequest":
      return state.phase === "closed" || state.phase === "dragging" ? { phase: "opening", progress: state.progress } : state;

    case "settled":
      return state.phase === "opening" ? { phase: "open", progress: 1 } : state;
  }
}

export type CurtainVisit = {
  /** `location.hash` */
  hash: string;
  /** В этой вкладке шторку уже показывали (sessionStorage). */
  sessionFlag: boolean;
  /** `PerformanceNavigationTiming.type`: "navigate" | "reload" | "back_forward" | "prerender". */
  navigationType?: string;
};

/** Показывать ли шторку: только при первом заходе в сессии, без якоря в адресе, не после «обновить» и «назад». */
export function shouldShowCurtain({ hash, sessionFlag, navigationType }: CurtainVisit): boolean {
  if (hash && hash !== "#") return false;
  if (sessionFlag) return false;
  if (navigationType === "reload" || navigationType === "back_forward") return false;
  return true;
}

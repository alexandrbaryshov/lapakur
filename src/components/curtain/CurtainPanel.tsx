import { useEffect, useReducer, useRef, type CSSProperties, type PointerEvent } from "react";
import { animate, m, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import {
  curtainReducer,
  initialCurtainState,
  releaseVelocity,
  VELOCITY_WINDOW_MS,
  type DragSample,
} from "./state";
import { Picture } from "../Picture";
import styles from "../Curtain.module.css";

// Сама шторка: атлас на латунном карнизе во весь экран. Посетитель тянет его вправо мышью,
// пальцем или пером — ткань едет за ним и собирается складками у края (сдвиг --p, Motion).
// Решения — вернуть пружиной или открыть до конца — принимает curtainReducer.
// При reduced-motion ткань не едет, а растворяется (≤ 300 мс).

/** Порог: движение пальца, после которого понятно, тянут вбок или листают вниз. */
const AXIS_SLOP = 8;
/** Вертикальный свайп такой длины открывает шторку. */
const SWIPE_OPEN = 40;

const OPEN_KEYS = new Set(["Enter", " ", "Spacebar", "ArrowRight", "ArrowDown", "PageDown", "Escape"]);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

type Drag = {
  pointerId: number;
  x0: number;
  y0: number;
  p0: number;
  width: number;
  axis: "x" | "y" | null;
  samples: DragSample[];
};

export default function CurtainPanel({ onOpened }: { onOpened: () => void }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [state, dispatch] = useReducer(curtainReducer, initialCurtainState);
  const progress = useMotionValue(0);
  const fade = useMotionValue(1);
  const drag = useRef<Drag | null>(null);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const velocity = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(onOpened);
  useEffect(() => {
    openedRef.current = onOpened;
  });

  // Пока шторка на месте: прокрутка заперта, покров до гидрации снят, фокус — на стрелке.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    root.removeAttribute("data-curtain");
    buttonRef.current?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Колесо, клавиатура и вертикальный свайп открывают шторку — она не запирает сайт (R41i).
  useEffect(() => {
    if (state.phase === "opening" || state.phase === "open") return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > 2) dispatch({ type: "openRequest" });
    };
    const onKey = (event: KeyboardEvent) => {
      if (!OPEN_KEYS.has(event.key)) return;
      event.preventDefault();
      dispatch({ type: "openRequest" });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [state.phase]);

  // Ведём сдвиг к цели, которую выбрал редьюсер.
  useEffect(() => {
    running.current?.stop();
    if (state.phase === "dragging") return;

    if (state.phase === "closed") {
      if (progress.get() > 0) {
        running.current = animate(progress, 0, { type: "spring", stiffness: 320, damping: 26, velocity: velocity.current });
      }
      return;
    }

    if (state.phase === "opening") {
      const done = () => dispatch({ type: "settled" });
      running.current = reduceMotion
        ? animate(fade, 0, { duration: 0.28, ease: "easeOut", onComplete: done })
        : animate(progress, 1, {
            type: "spring",
            visualDuration: 0.9,
            bounce: 0,
            velocity: Math.max(velocity.current, 0),
            // ткань уже за краем — не ждём, пока пружина успокоится в тысячных
            restDelta: 0.004,
            restSpeed: 0.05,
            onComplete: done,
          });
      return;
    }

    openedRef.current();
  }, [state.phase, reduceMotion, progress, fade]);

  useEffect(() => () => running.current?.stop(), []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (state.phase !== "closed") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    running.current?.stop();
    const p0 = progress.get();
    drag.current = {
      pointerId: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      p0,
      width: Math.max(1, event.currentTarget.clientWidth),
      axis: null,
      samples: [{ t: event.timeStamp, p: p0 }],
    };
    dispatch({ type: "dragStart" });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const dx = event.clientX - d.x0;
    const dy = event.clientY - d.y0;
    if (!d.axis && Math.hypot(dx, dy) > AXIS_SLOP) d.axis = Math.abs(dy) > Math.abs(dx) * 1.2 ? "y" : "x";
    if (d.axis === "y") {
      if (Math.abs(dy) > SWIPE_OPEN) {
        drag.current = null;
        dispatch({ type: "openRequest" });
      }
      return;
    }
    if (d.axis !== "x") return;
    const p = clamp01(d.p0 + dx / d.width);
    progress.set(p);
    if (reduceMotion) fade.set(1 - p * 0.6);
    d.samples.push({ t: event.timeStamp, p });
    // для скорости нужны только последние VELOCITY_WINDOW_MS — старые отметки не копим
    while (d.samples.length > 2 && event.timeStamp - d.samples[0].t > VELOCITY_WINDOW_MS) d.samples.shift();
    dispatch({ type: "dragMove", progress: p });
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    const p = progress.get();
    // скорость — по движению за ~100 мс до отпускания, с меткой самого отпускания:
    // палец замер дольше — скорость 0, и решает порог, а не давний рывок
    velocity.current = releaseVelocity(d.samples, { t: event.timeStamp, p });
    if (reduceMotion) fade.set(1);
    dispatch({ type: "release", progress: p, velocity: velocity.current });
  };

  return (
    <m.div
      className={styles.root}
      role="dialog"
      aria-modal="true"
      aria-labelledby="curtain-title"
      data-phase={state.phase}
      data-reduced={reduceMotion || undefined}
      style={{ "--p": progress, opacity: fade } as unknown as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div className={styles.fabric} aria-hidden="true" />
      <div className={styles.edge} aria-hidden="true" />
      <Picture
        media="curtain-rod"
        sizes="(max-width: 899px) and (min-resolution: 2.5dppx) 266px, 100vw"
        alt=""
        priority
        className={styles.rod}
        imgClassName={styles.rodImg}
      />
      <div className={styles.label}>
        <p id="curtain-title" className={styles.title}>
          Узнайте, чем занимается ваш питомец
        </p>
        <button
          ref={buttonRef}
          type="button"
          className={styles.open}
          aria-label="Открыть шторку"
          onClick={() => dispatch({ type: "openRequest" })}
        >
          <svg className={styles.arrow} viewBox="0 0 120 24" aria-hidden="true" focusable="false">
            <path d="M1 12H117M103 2.5L117.5 12L103 21.5" />
          </svg>
        </button>
      </div>
    </m.div>
  );
}

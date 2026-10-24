import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";
import { COVER_H, COVER_W, MASTHEAD, guidePath } from "../components/cover/layout";
import { clampView, coverFit, zoomAt, type View } from "../components/cover/view";
import { coverBlob, ensureCoverFonts, framePhoto, gradePhoto, renderCover, shrink, type Graded } from "../components/cover/render";
import type { PetSegmenter } from "../components/cover/segment";
import { useZoom } from "../components/zoom";
import { PET_NAME_MAX } from "../data/cover";
import { pickSensation } from "../data/sensations";
import { STUDIO } from "../data/studio";
import styles from "./CoverStudio.module.css";

// Обложка журнала «Лапакюр» с питомцем посетителя. Камера (или фото из галереи) — под рамкой-
// подсказкой: голова питомца встаёт в рамку чуть заходя на шапку, и обложка в итоге совпадает
// с тем, что было видно в рамке. Готовая обложка: имя питомца, случайная сенсация, строки о студии;
// голова встаёт перед нижней частью шапки по маске сегментатора (ленивый чанк, только наш хост).
// Фото никуда не отправляется. Рендерится только на клиенте и только после первого открытия (lazy в Works).

export type CoverStudioProps = { open: boolean; onClose: () => void };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
const GUIDE_PATH = guidePath();
/** Маска считается найденным питомцем, если он занимает хотя бы 2 % кадра. */
const PET_MIN_COVERAGE = 0.02;

export function CoverStudio({ open, onClose }: CoverStudioProps) {
  return createPortal(<AnimatePresence>{open && <Studio key="cover-studio" onClose={onClose} />}</AnimatePresence>, document.body);
}

type Step = "camera" | "adjust" | "result";
type CameraState = "starting" | "live" | "denied" | "unavailable";
type HeadState = "working" | "done" | "none" | "off";
type Picked = { url: string; image: HTMLImageElement; w: number; h: number };
type Shot = { id: number; graded: Graded };

type Connection = Navigator & { connection?: { saveData?: boolean } };

function Studio({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const zoom = useZoom(1.05);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const segmenter = useRef<Promise<PetSegmenter | null> | null>(null);

  const [step, setStep] = useState<Step>("camera");
  const [camera, setCamera] = useState<CameraState>("starting");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [canSwitch, setCanSwitch] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [shot, setShot] = useState<Shot | null>(null);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [head, setHead] = useState<HeadState>("off");
  const [fontsReady, setFontsReady] = useState(false);
  const [name, setName] = useState("");
  const [sensation, setSensation] = useState(() => pickSensation());
  const [busy, setBusy] = useState(false);
  const canShare = useMemo(() => {
    try {
      return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "cover.jpg", { type: "image/jpeg" })] });
    } catch {
      return false;
    }
  }, []);
  /** Телефон или планшет: кнопка сохраняет «в галерею», на компьютере — скачивает файл. */
  const touch = useMemo(() => window.matchMedia?.("(pointer: coarse)").matches ?? false, []);
  /** iPhone и iPad: сохранить в «Фото» можно только через меню «Поделиться». */
  const saveViaShare = useMemo(
    () => canShare && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)),
    [canShare],
  );

  // окно: страница не прокручивается, фокус внутри, Esc закрывает
  useEffect(() => {
    const root = document.documentElement;
    const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previous.overflow;
      root.style.paddingRight = previous.paddingRight;
    };
  }, [onClose]);

  // шрифты обложки и сегментатор (~14 МБ) — сразу, пока посетитель наводит камеру; при Save-Data — без головы перед шапкой
  useEffect(() => {
    let alive = true;
    ensureCoverFonts().then(() => alive && setFontsReady(true));
    if (!(navigator as Connection).connection?.saveData) {
      segmenter.current = import("../components/cover/segment").then((mod) => mod.loadPetSegmenter()).catch(() => null);
    }
    return () => {
      alive = false;
    };
  }, []);

  // камера — только на шаге камеры; уходя, гасим
  useEffect(() => {
    if (step !== "camera") return;
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setCamera("unavailable");
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    const video = videoRef.current;
    setCamera("starting");
    media
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1440 }, height: { ideal: 1920 } } })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video) {
          video.srcObject = s;
          await video.play().catch(() => {});
        }
        setCamera("live");
        const devices = await media.enumerateDevices().catch(() => []);
        setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        setCamera(denied ? "denied" : "unavailable");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };
  }, [step, facing]);

  // выбранное фото из галереи живёт, пока окно открыто
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.url);
  }, [picked]);

  const shotId = useRef(0);

  /** Кадр готов: цветокоррекция, обложка без маски сразу, голова перед шапкой — когда посчитается. */
  const finish = useCallback((frame: HTMLCanvasElement) => {
    const id = ++shotId.current;
    setShot({ id, graded: gradePhoto(frame) });
    setMask(null);
    // каждому кадру — своя случайная сенсация (не та же, что на прошлой обложке)
    if (id > 1) setSensation((current) => pickSensation(current));
    setCover(null);
    setSaveHint("");
    setStep("result");
    const pending = segmenter.current;
    if (!pending) {
      setHead("off");
      return;
    }
    setHead("working");
    const small = shrink(frame);
    pending
      .then((seg) => {
        if (id !== shotId.current) return;
        const found = seg?.segment(small);
        const pet = found && found.coverage >= PET_MIN_COVERAGE ? found.canvas : null;
        setMask(pet);
        setHead(seg ? (pet ? "done" : "none") : "off");
      })
      .catch(() => id === shotId.current && setHead("off"));
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    finish(framePhoto(video, coverFit(video.videoWidth, video.videoHeight), facing === "user"));
  };

  const onPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      const next = { url, image, w: image.naturalWidth, h: image.naturalHeight };
      setPicked(next);
      setView(coverFit(next.w, next.h));
      setStep("adjust");
    } catch {
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  // ── подгонка фото из галереи: перетаскивание, щипок, колесо, ползунок ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const unitsPerPx = () => COVER_W / (stageRef.current?.getBoundingClientRect().width || COVER_W);
  const toCover = (clientX: number, clientY: number) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: COVER_W / 2, y: COVER_H / 2 };
    return { x: ((clientX - r.left) / r.width) * COVER_W, y: ((clientY - r.top) / r.height) * COVER_H };
  };
  const applyView = useCallback(
    (next: View) => {
      if (picked) setView(clampView(next, picked.w, picked.h));
    },
    [picked],
  );
  const zoomTo = (target: View, scale: number, px: number, py: number) => {
    if (!picked) return;
    const clamped = clampView({ ...target, scale }, picked.w, picked.h).scale;
    applyView(zoomAt(target, clamped / target.scale, px, py));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (step !== "adjust") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    const prev = map.get(event.pointerId);
    if (step !== "adjust" || !prev) return;
    const others = [...map.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
    map.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const k = unitsPerPx();
    if (others.length === 0) {
      applyView({ ...view, x: view.x + (event.clientX - prev.x) * k, y: view.y + (event.clientY - prev.y) * k });
      return;
    }
    const other = others[0];
    const before = Math.hypot(prev.x - other.x, prev.y - other.y);
    const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
    if (before < 1) return;
    const mid = toCover((event.clientX + other.x) / 2, (event.clientY + other.y) / 2);
    const panned = { ...view, x: view.x + ((event.clientX - prev.x) / 2) * k, y: view.y + ((event.clientY - prev.y) / 2) * k };
    zoomTo(panned, view.scale * (after / before), mid.x, mid.y);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (step !== "adjust") return;
    const p = toCover(event.clientX, event.clientY);
    zoomTo(view, view.scale * Math.exp(-event.deltaY * 0.0015), p.x, p.y);
  };
  /** С клавиатуры: стрелки двигают фото, плюс и минус — масштаб. */
  const onStageKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (step !== "adjust") return;
    const nudge = 40;
    const moves: Record<string, [number, number]> = { ArrowLeft: [nudge, 0], ArrowRight: [-nudge, 0], ArrowUp: [0, nudge], ArrowDown: [0, -nudge] };
    const move = moves[event.key];
    if (move) applyView({ ...view, x: view.x + move[0], y: view.y + move[1] });
    else if (event.key === "+" || event.key === "=") zoomTo(view, view.scale * 1.1, COVER_W / 2, COVER_H / 2);
    else if (event.key === "-") zoomTo(view, view.scale / 1.1, COVER_W / 2, COVER_H / 2);
    else return;
    event.preventDefault();
  };
  const minScale = picked ? coverFit(picked.w, picked.h).scale : 1;
  const onZoomRange = (event: ChangeEvent<HTMLInputElement>) => {
    zoomTo(view, minScale * Number(event.target.value), COVER_W / 2, COVER_H / 2);
  };

  const confirmAdjust = () => {
    if (picked) finish(framePhoto(picked.image, view));
  };

  // ── готовая обложка: рисуется на canvas вне страницы, показывается картинкой JPEG ──
  // Картинку можно удержать пальцем и сохранить в «Фото» / галерею — canvas телефон так не сохраняет.
  const coverCanvas = useRef<HTMLCanvasElement | null>(null);
  const [cover, setCover] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (step !== "result" || !shot || !fontsReady) return;
    const target = (coverCanvas.current ??= document.createElement("canvas"));
    renderCover(target, { graded: shot.graded, mask, name, sensation, date: new Date() });
    let alive = true;
    const timer = window.setTimeout(() => {
      coverBlob(target)
        .then((blob) => alive && setCover({ blob, url: URL.createObjectURL(blob) }))
        .catch(() => {});
    }, 80);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [step, shot, mask, name, sensation, fontsReady]);
  useEffect(() => () => {
    if (cover) URL.revokeObjectURL(cover.url);
  }, [cover]);

  const fileName = "lapakur-oblozhka.jpg";
  const [saveHint, setSaveHint] = useState("");
  const download = () => {
    if (!cover) return;
    const link = document.createElement("a");
    link.href = cover.url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  };
  /** Меню «Поделиться» с одной картинкой; true — меню открылось (на iPhone в нём «Сохранить изображение»). */
  const shareImage = async () => {
    if (!cover) return false;
    try {
      // только файл, без текста: с подписью iPhone прячет «Сохранить изображение»
      await navigator.share({ files: [new File([cover.blob], fileName, { type: "image/jpeg" })] });
      return true;
    } catch (error) {
      return error instanceof DOMException && error.name === "AbortError";
    }
  };
  /**
   * В галерею: на iPhone загрузка уходит в «Файлы», а в «Фото» картинку кладёт пункт «Сохранить изображение»
   * меню «Поделиться». На Android загруженная картинка сама появляется в галерее (альбом «Download»).
   */
  const saveToGallery = async () => {
    if (saveViaShare) {
      setSaveHint("В меню выберите «Сохранить изображение» — обложка попадёт в «Фото».");
      if (await shareImage()) return;
    }
    download();
    setSaveHint(touch ? "Обложка сохранена — она в галерее, в альбоме «Download»." : "");
  };
  const share = async () => {
    if (!(await shareImage())) download();
  };

  const retake = () => {
    shotId.current++;
    setShot(null);
    setMask(null);
    setStep(picked ? "adjust" : "camera");
  };
  const toCamera = () => {
    setPicked(null);
    setStep("camera");
  };

  const ease = [0.16, 1, 0.3, 1] as const;
  const showGuide = step !== "result";
  const cameraBlocked = step === "camera" && (camera === "denied" || camera === "unavailable");

  return (
    <m.div
      className={styles.backdrop}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.32, ease }}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-studio-title"
        data-cover-studio={step}
        data-head={step === "result" ? head : undefined}
      >
        <header className={styles.head}>
          <h2 id="cover-studio-title" className={styles.title}>
            Обложка «{STUDIO.name}»
          </h2>
          <m.button ref={closeRef} type="button" className={styles.close} onClick={onClose} {...zoom}>
            <span className={styles.cross} aria-hidden="true" />
            <span className="visually-hidden">Закрыть</span>
          </m.button>
        </header>

        <div className={styles.stageBox}>
          <div
            ref={stageRef}
            className={styles.stage}
            data-step={step}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onStageKey}
            tabIndex={step === "adjust" ? 0 : undefined}
            role={step === "adjust" ? "group" : undefined}
            aria-label={step === "adjust" ? "Фото питомца: стрелки двигают, плюс и минус меняют масштаб" : undefined}
          >
            {step === "camera" && (
              <video
                ref={videoRef}
                className={styles.video}
                data-mirror={facing === "user" || undefined}
                data-live={camera === "live" || undefined}
                muted
                playsInline
                autoPlay
                aria-hidden="true"
              />
            )}
            {step === "adjust" && picked && (
              <img
                className={styles.picked}
                src={picked.url}
                alt=""
                draggable={false}
                style={{
                  left: `${(view.x / COVER_W) * 100}%`,
                  top: `${(view.y / COVER_H) * 100}%`,
                  width: `${((picked.w * view.scale) / COVER_W) * 100}%`,
                  height: `${((picked.h * view.scale) / COVER_H) * 100}%`,
                }}
              />
            )}
            {step === "result" && cover && (
              <img
                className={styles.cover}
                src={cover.url}
                alt={`Обложка журнала «${STUDIO.name}»${name.trim() ? ` с питомцем по имени ${name.trim()}` : ""}`}
                data-cover-image
              />
            )}

            {showGuide && !cameraBlocked && (
              <svg className={styles.guide} viewBox={`0 0 ${COVER_W} ${COVER_H}`} aria-hidden="true">
                <path className={styles.veil} d={`M0 0H${COVER_W}V${COVER_H}H0Z ${GUIDE_PATH}`} fillRule="evenodd" />
                <path className={styles.outline} d={GUIDE_PATH} />
                <text
                  className={styles.mast}
                  x={MASTHEAD.left}
                  y={MASTHEAD.baseline}
                  fontSize={MASTHEAD.size}
                  textLength={MASTHEAD.right - MASTHEAD.left}
                  lengthAdjust="spacingAndGlyphs"
                >
                  {STUDIO.name.toLocaleUpperCase("ru")}
                </text>
              </svg>
            )}
            {showGuide && !cameraBlocked && (
              <p className={styles.hint}>
                {step === "camera" ? "Голова питомца — в рамку, чуть заходя на название" : "Двигайте и увеличьте фото: голова — в рамку"}
              </p>
            )}

            {cameraBlocked && (
              <div className={styles.blocked}>
                <p className={styles.blockedText}>
                  {camera === "denied"
                    ? "Доступ к камере закрыт. Разрешите его в настройках браузера или выберите готовое фото."
                    : "Камера недоступна на этом устройстве. Выберите фото питомца из галереи."}
                </p>
                <button type="button" className={styles.action} onClick={() => fileRef.current?.click()} disabled={busy}>
                  Выбрать фото
                </button>
              </div>
            )}
          </div>
        </div>

        <input ref={fileRef} className="visually-hidden" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={onPick} />

        <div className={styles.controls} data-step={step}>
          {step === "camera" && !cameraBlocked && (
            <div className={styles.cameraRow}>
              <button type="button" className={styles.side} onClick={() => fileRef.current?.click()} disabled={busy}>
                Из галереи
              </button>
              <button type="button" className={styles.shutter} onClick={capture} disabled={camera !== "live"}>
                <span className="visually-hidden">Снять обложку</span>
              </button>
              {canSwitch ? (
                <button type="button" className={styles.side} onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}>
                  Сменить камеру
                </button>
              ) : (
                <span className={styles.side} aria-hidden="true" />
              )}
            </div>
          )}

          {step === "adjust" && picked && (
            <>
              <label className={styles.zoomLabel}>
                <span className={styles.fieldName}>Масштаб</span>
                <input
                  className={styles.range}
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={view.scale / minScale}
                  onChange={onZoomRange}
                />
              </label>
              <div className={styles.row}>
                <button type="button" className={styles.side} onClick={toCamera}>
                  Назад к камере
                </button>
                <button type="button" className={styles.action} onClick={confirmAdjust}>
                  Готово
                </button>
              </div>
            </>
          )}

          {step === "result" && (
            <>
              <label className={styles.field}>
                <span className={styles.fieldName}>Имя питомца</span>
                <input
                  className={styles.input}
                  type="text"
                  value={name}
                  maxLength={PET_NAME_MAX}
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="Например, Боня"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <div className={styles.row}>
                <button type="button" className={styles.side} onClick={() => setSensation((s) => pickSensation(s))}>
                  Другая сенсация
                </button>
                <button type="button" className={styles.side} onClick={retake}>
                  {picked ? "Подвинуть фото" : "Переснять"}
                </button>
              </div>
              <div className={styles.row}>
                <button type="button" className={styles.action} onClick={saveToGallery} disabled={!cover}>
                  {touch ? "Сохранить в галерею" : "Скачать обложку"}
                </button>
                {canShare && (
                  <button type="button" className={styles.action} onClick={share} disabled={!cover}>
                    Поделиться
                  </button>
                )}
              </div>
              <p className={styles.status} aria-live="polite">
                {saveHint ||
                  (head === "working" ? "Ставим питомца перед названием…" : head === "none" ? "Питомца в кадре не нашли — название поверх фото" : "")}
              </p>
              {touch && <p className={styles.status}>Или удерживайте палец на обложке — телефон предложит сохранить её в галерею.</p>}
            </>
          )}
        </div>
      </div>
    </m.div>
  );
}

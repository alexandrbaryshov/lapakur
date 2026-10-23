import {
  animate,
  m,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { buildThread, drawnFraction, type Box, type InkSamples, type ThreadLayout } from "./InkLine.geometry";
import styles from "./InkLine.module.css";

// Рисование сквозной нити (ленивый чанк InkLine). Путь строится по раскладке страницы и
// перестраивается при её изменении (шрифты, раскрытый вопрос, поворот экрана). Нарисованная
// доля — pathLength от прокрутки (useScroll): перо идёт на 72 % высоты экрана, нить
// дорисовывается и уже не стирается. Пока страница под шторкой, нить не видна; когда шторка
// ушла — она за 2,6 с проходит от логотипа вокруг обложки. При reduced-motion — целиком сразу.

/** Перо — на этой доле высоты экрана: нить чуть опережает взгляд. */
const PEN = 0.72;
/** Шаг отсчётов пути, px. */
const SAMPLE_STEP = 6;
const ENTRANCE = { duration: 2.6, ease: [0.45, 0.05, 0.2, 1] as const };

type Shape = { d: string; heroD: string; width: number; height: number; top: number };

function union(boxes: Box[]): Box | undefined {
  if (boxes.length === 0) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const btm = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}

/** Раскладка страницы для линии: прямоугольники блоков, а для заголовков и телефона — рамка текста. */
function readLayout(page: HTMLElement): (ThreadLayout & { height: number }) | null {
  const origin = page.getBoundingClientRect();
  if (origin.width === 0) return null;
  const toBox = (r: DOMRect): Box | undefined =>
    r.width || r.height ? { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height } : undefined;
  const block = (el: Element | null) => (el ? toBox(el.getBoundingClientRect()) : undefined);
  const text = (el: Element | null) => {
    if (!el) return undefined;
    const range = document.createRange();
    range.selectNodeContents(el);
    return toBox(range.getBoundingClientRect()) ?? block(el);
  };
  const all = (selector: string) => [...page.querySelectorAll(selector)].map(block).filter((b): b is Box => !!b);

  const logo = block(page.querySelector('header a[href="#top"]'));
  const masthead = block(page.querySelector("#top h1"));
  const plate = block(page.querySelector("#top figure"));
  const phone = text(page.querySelector('#contacts a[href^="tel:"]'));
  if (!logo || !masthead || !plate || !phone) return null;
  const price = block(page.querySelector("#price"));

  return {
    width: origin.width,
    height: origin.height,
    logo,
    call: block(page.querySelector('header a[href^="tel:"]')),
    navLinks: all("header nav a"),
    masthead,
    plate,
    tagline: text(page.querySelector("#top p")),
    services: union(all("#top li")),
    priceHeading: text(page.querySelector("#price h2")),
    pricePhotos: union(all("#price figure")),
    sheets: all("#price section"),
    priceBottom: price ? price.y + price.h : undefined,
    worksTitle: text(page.querySelector("#works h2")),
    // кадры эссе и рамка-приглашение на обложку
    works: all("#works figure, #works [data-cover-invite]"),
    faqTitle: text(page.querySelector("#faq h2")),
    faqList: block(page.querySelector("#faq ul")),
    contactsTitle: text(page.querySelector("#contacts h2")),
    phone,
  };
}

export default function InkThread({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const heroRef = useRef<SVGPathElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [shape, setShape] = useState<Shape | null>(null);
  const samples = useRef<InkSamples | null>(null);
  const pen = useRef(0);
  const jump = useRef(true);

  const entrance = useMotionValue(0);
  const target = useMotionValue(0);
  const drawn = useSpring(target, { stiffness: 70, damping: 20, restDelta: 0.0002 });
  const opacity = useTransform(drawn, (v) => (v > 0.0005 ? 1 : 0));
  const { scrollY } = useScroll();

  const update = useCallback(() => {
    const s = samples.current;
    if (!s) return;
    const value = drawnFraction(s, pen.current, entrance.get());
    target.set(value);
    if (jump.current) {
      drawn.jump(value);
      jump.current = false;
    }
  }, [drawn, entrance, target]);

  // путь по раскладке страницы; перестраивается, когда страница меняет размер
  useEffect(() => {
    const page = svgRef.current?.parentElement;
    if (!page) return;
    let timer = 0;
    const measure = () => {
      const layout = readLayout(page);
      if (!layout) return;
      const thread = buildThread(layout);
      const top = page.getBoundingClientRect().top + window.scrollY;
      setShape((prev) =>
        prev && prev.d === thread.d && prev.height === layout.height && prev.top === top
          ? prev
          : { ...thread, width: layout.width, height: layout.height, top },
      );
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 150);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(page);
    document.fonts?.ready.then(schedule, () => {});
    return () => {
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // отсчёты нового пути: длина, высота; нить сразу встаёт в положение пера
  useLayoutEffect(() => {
    const path = pathRef.current;
    const hero = heroRef.current;
    if (!shape || reduce || !path || !hero || typeof path.getTotalLength !== "function") return;
    const total = path.getTotalLength();
    const n = Math.max(2, Math.ceil(total / SAMPLE_STEP) + 1);
    const lengths = new Float64Array(n);
    const maxY = new Float64Array(n);
    let low = -Infinity;
    for (let i = 0; i < n; i++) {
      const len = Math.min(total, i * SAMPLE_STEP);
      low = Math.max(low, path.getPointAtLength(len).y);
      lengths[i] = len;
      maxY[i] = low;
    }
    samples.current = { lengths, maxY, total, heroLength: hero.getTotalLength() };
    pen.current = Math.max(pen.current, window.scrollY + window.innerHeight * PEN - shape.top);
    jump.current = true;
    update();
  }, [shape, reduce, update]);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (!shape) return;
    pen.current = Math.max(pen.current, y + window.innerHeight * PEN - shape.top);
    update();
  });
  useMotionValueEvent(entrance, "change", update);

  // появление: пока страница под шторкой — нити нет; шторка ушла — нить идёт от логотипа
  useEffect(() => {
    if (reduce) return;
    const root = document.documentElement;
    const page = svgRef.current?.parentElement;
    const covered = () => root.hasAttribute("data-curtain") || !!page?.hasAttribute("inert");
    if (!covered()) {
      entrance.set(1);
      return;
    }
    let controls: AnimationPlaybackControls | undefined;
    const observer = new MutationObserver(() => {
      if (covered()) return;
      observer.disconnect();
      controls = animate(entrance, 1, ENTRANCE);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-curtain"] });
    if (page) observer.observe(page, { attributes: true, attributeFilter: ["inert"] });
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [reduce, entrance]);

  return (
    <svg
      ref={svgRef}
      className={[styles.ink, className].filter(Boolean).join(" ")}
      data-region="ink-thread"
      viewBox={shape ? `0 0 ${shape.width} ${shape.height}` : undefined}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {shape &&
        (reduce ? (
          <path d={shape.d} className={styles.path} />
        ) : (
          <>
            <path ref={heroRef} d={shape.heroD} className={styles.measure} />
            <m.path ref={pathRef} d={shape.d} className={styles.path} style={{ pathLength: drawn, opacity }} />
          </>
        ))}
    </svg>
  );
}

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { CURTAIN_SESSION_KEY, shouldShowCurtain, type CurtainVisit } from "./curtain/state";

// Шторка первого открытия (spec.md, истории 7–12; interfaces.md → «Компоненты»).
// Здесь — только решение «показывать ли»: без JS и в пререндере шторки нет, её разметка
// появляется в эффекте после shouldShowCurtain. Сама шторка с жестами и пружинами
// (CurtainPanel) — отдельным чанком: пока он грузится, тот же атлас рисует покров
// до гидрации (CSS по <html data-curtain="pending">), и обложка не мелькает.
// Медленная сеть: покров ушёл по таймауту до гидрации — шторки нет; ушёл, пока чанк
// панели ещё грузится, — шторка снимается, страница не остаётся inert.

const CurtainPanel = lazy(() => import("./curtain/CurtainPanel"));

/**
 * Сколько держится покров до гидрации, если JS страницы так и не пришёл: потом он уходит сам
 * (<html data-curtain="expired">, global.css), и шторка в этот заход уже не показывается.
 */
export const CURTAIN_COVER_TIMEOUT_MS = 12_000;

/** Значение data-curtain после таймаута покрова. */
const CURTAIN_EXPIRED = "expired";

/** Сколько растворяется покров после таймаута (animation в global.css). */
const COVER_FADE_MS = 400;

/**
 * Встроенный скрипт до гидрации: если шторку покажут, ставит <html data-curtain="pending">
 * и через CURTAIN_COVER_TIMEOUT_MS, если панель шторки к тому времени не смонтировалась
 * (она снимает атрибут), переводит его в "expired". Таймер один — здесь; CSS только рисует.
 * Решение «показывать ли» повторяет shouldShowCurtain — tests/curtain.test.ts сверяет их на одних входах.
 */
export const CURTAIN_BOOT_SCRIPT =
  "(function(){try{var h=location.hash,f=false;" +
  `try{f=sessionStorage.getItem(${JSON.stringify(CURTAIN_SESSION_KEY)})==="1"}catch(e){}` +
  'var n=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0],t=n&&n.type;' +
  'if((h&&h!=="#")||f||t==="reload"||t==="back_forward")return;' +
  'var d=document.documentElement;d.setAttribute("data-curtain","pending");' +
  'setTimeout(function(){try{if(d.getAttribute("data-curtain")==="pending")' +
  `d.setAttribute("data-curtain","${CURTAIN_EXPIRED}")}catch(e){}},${CURTAIN_COVER_TIMEOUT_MS})` +
  "}catch(e){}})();";

function readVisit(): CurtainVisit {
  let sessionFlag = false;
  try {
    sessionFlag = window.sessionStorage.getItem(CURTAIN_SESSION_KEY) === "1";
  } catch {
    /* хранилище недоступно — считаем первым заходом */
  }
  let navigationType: string | undefined;
  try {
    const entry = window.performance?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    navigationType = entry?.type;
  } catch {
    navigationType = undefined;
  }
  return { hash: window.location.hash, sessionFlag, navigationType };
}

export type CurtainProps = {
  /** Шторка ушла, страница свободна. */
  onOpened?: () => void;
  /** Шторка показана (например, чтобы сделать страницу под ней inert). */
  onShow?: () => void;
  /** Кому отдать фокус, когда шторку открыли и страница снова доступна: id элемента (шапка ЛАПАКЮР). */
  focusTargetId?: string;
};

type Phase = "idle" | "shown" | "opened" | "dropped";

export function Curtain({ onOpened, onShow, focusTargetId = "top-title" }: CurtainProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const decided = useRef(false);
  const openedRef = useRef(onOpened);
  useEffect(() => {
    openedRef.current = onOpened;
  });

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    const root = document.documentElement;
    // покров до гидрации уже снят по таймауту (CURTAIN_BOOT_SCRIPT): посетитель видит страницу —
    // шторка поверх неё не выезжает
    if (root.getAttribute("data-curtain") === CURTAIN_EXPIRED) {
      root.removeAttribute("data-curtain");
      return;
    }
    if (shouldShowCurtain(readVisit())) {
      try {
        window.sessionStorage.setItem(CURTAIN_SESSION_KEY, "1");
      } catch {
        /* без хранилища шторка покажется и при обновлении — не страшно */
      }
      setPhase("shown");
      onShow?.();
    } else {
      root.removeAttribute("data-curtain");
    }
  }, [onShow]);

  // Покров снялся по таймауту, а панель так и не смонтировалась (она сама убирает атрибут
  // при монтировании) — отдаём страницу, а не оставляем её inert под пустотой.
  useEffect(() => {
    if (phase !== "shown") return;
    const root = document.documentElement;
    const check = () => {
      if (root.getAttribute("data-curtain") !== CURTAIN_EXPIRED) return;
      setPhase("dropped");
      openedRef.current?.();
      // покров растворяется 0,4 с (global.css) — потом атрибут больше не нужен (по нему, например,
      // сквозная линия ждёт, пока страница откроется)
      window.setTimeout(() => {
        if (root.getAttribute("data-curtain") === CURTAIN_EXPIRED) root.removeAttribute("data-curtain");
      }, COVER_FADE_MS);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(root, { attributes: true, attributeFilter: ["data-curtain"] });
    return () => observer.disconnect();
  }, [phase]);

  // Шторку открыли: страница уже не inert (тот же коммит) — фокус на шапку, без прокрутки.
  useEffect(() => {
    if (phase !== "opened") return;
    document.getElementById(focusTargetId)?.focus({ preventScroll: true });
  }, [phase, focusTargetId]);

  if (phase !== "shown") return null;
  const opened = () => {
    setPhase("opened");
    onOpened?.();
  };
  const failed = () => {
    setPhase("dropped");
    onOpened?.();
  };
  return (
    <PanelGuard onError={failed}>
      <Suspense fallback={null}>
        <CurtainPanel onOpened={opened} />
      </Suspense>
    </PanelGuard>
  );
}

/** Чанк шторки не загрузился — снимаем покров и отдаём страницу, а не роняем приложение. */
class PanelGuard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    document.documentElement.removeAttribute("data-curtain");
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

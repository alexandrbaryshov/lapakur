import { lazy, Suspense, useEffect, useState } from "react";

// Сквозная линия «Ателье одной линии» (spec.md, «Направление»; impeccable: ink-thread, codeDrawn):
// одна чернильная нить выходит из линии земли логотипа, обвивает обложку и прошивает страницу
// до телефона в визите. После шторки она рисуется от логотипа вокруг обложки, ниже — дорисовывается
// прокруткой; при reduced-motion нарисована целиком. Геометрия — InkLine.geometry.ts,
// рисование — InkLine.thread.tsx (отдельный чанк, после load: на медленной сети первый экран
// приходит первым, нить — украшение — догружается следом, как и видео обложки).

export { HERO_INK_PATH } from "./InkLine.geometry";

const InkThread = lazy(() => import("./InkLine.thread"));

/**
 * Линия рисуется на клиенте, после события load: путь строится по раскладке страницы (замеры DOM),
 * а не по координатам из пререндера. В пререндере и без JS её нет — страница от этого не теряет смысла.
 */
export function InkLine({ className }: { className?: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const go = () => setLoaded(true);
    if (document.readyState === "complete") {
      const id = window.setTimeout(go, 0);
      return () => window.clearTimeout(id);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, []);
  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <InkThread className={className} />
    </Suspense>
  );
}

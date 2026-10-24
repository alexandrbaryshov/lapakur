import { useCallback, useState } from "react";
import { preload } from "react-dom";
import prataCyrillic from "../node_modules/@fontsource/prata/files/prata-cyrillic-400-normal.woff2?url";
import { Curtain, CURTAIN_BOOT_SCRIPT } from "./components/Curtain";
import { InkLine } from "./components/InkLine";
import { MotionProvider } from "./components/MotionProvider";
import { StudioJsonLd } from "./components/StudioJsonLd";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { Prices, SHEETS_FLAG_SCRIPT } from "./sections/Prices";
import { StickyCall } from "./sections/StickyCall";
import { Visit } from "./sections/Visit";
import { Works } from "./sections/Works";
import "./styles/global.css";

// Каркас страницы: порядок экранов и якоря зафиксированы спецификацией
// (#top, #price, #works, #faq, #contacts).
//
// App пререндерится на сборке (scripts/build.mjs → renderToString) и гидрируется
// в браузере: при рендере не обращайтесь к window/document/sessionStorage —
// только в эффектах и обработчиках.

/** На сборке путь шрифта абсолютный («/assets/…»), страница же открывается с base "./". */
const PRATA_HREF = prataCyrillic.startsWith("/") ? `.${prataCyrillic}` : prataCyrillic;

/**
 * Встроенный скрипт для <head> (scripts/build.mjs ставит его на место <!--head-script--> в index.html):
 * флаги <html> до первой отрисовки — листы прайса прячутся, покров шторки встаёт.
 * Только в <head> до стилей: там он выполняется сразу. Внутри разметки страницы встроенный скрипт ждёт
 * таблицу стилей, и пока разбор стоит, Safari (WebKit) заранее запрашивает картинки дальше по разметке —
 * и ленивые <picture> ниже первого экрана тоже: на iPhone они грузились под шторкой и отнимали полосу
 * у первого экрана и видео обложки.
 */
export const HEAD_SCRIPT = `${SHEETS_FLAG_SCRIPT};${CURTAIN_BOOT_SCRIPT}`;

export default function App() {
  // Шрифт шапки — первым (R36): кириллица Prata, ~13 КБ.
  preload(PRATA_HREF, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  const [covered, setCovered] = useState(false);
  const onShow = useCallback(() => setCovered(true), []);
  const onOpened = useCallback(() => setCovered(false), []);

  return (
    <MotionProvider>
      <StudioJsonLd />
      <div className="page" inert={covered || undefined}>
        <InkLine />
        <Header />
        <main>
          <Hero />
          <Prices />
          <Works />
          <Faq />
          <Visit />
        </main>
        <Footer />
      </div>
      {/* вне .page: у контейнера страницы своя раскладка, fixed внутри неё не держался бы экрана */}
      <StickyCall />
      <Curtain onShow={onShow} onOpened={onOpened} />
    </MotionProvider>
  );
}

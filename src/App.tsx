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
import { Prices } from "./sections/Prices";
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

export default function App() {
  // Шрифт шапки — первым (R36): кириллица Prata, ~13 КБ.
  preload(PRATA_HREF, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });

  const [covered, setCovered] = useState(false);
  const onShow = useCallback(() => setCovered(true), []);
  const onOpened = useCallback(() => setCovered(false), []);

  return (
    <MotionProvider>
      {/* скрипт выполняется браузером при разборе пререндера; на клиенте React его не создаёт */}
      <div hidden dangerouslySetInnerHTML={{ __html: `<script>${CURTAIN_BOOT_SCRIPT}</script>` }} />
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

# Архитектура Лапакюра

Статичный лендинг: React 19 + Vite 6, пререндер на сборке, гидрация в браузере. Бэкенда нет.

## Поток данных

- Факты студии (цены, контакты, отзывы, FAQ) лежат только в `src/data/`; разметки там нет, секции строятся из них.
- Медиа: `media-src/<ключ>.<ext>` -> `scripts/media.mjs` по `media.config.mjs` -> `public/media/` + `src/media/manifest.ts` (генерируется, руками не правится). Компоненты берут ассеты через `getImage` / `getVideo` из `src/media/index.ts`.
- Сборка `scripts/build.mjs`: `vite build`, затем SSR-проход `src/App.tsx` через `renderToString`; разметка подставляется в `dist/index.html` вместо `<!--app-html-->`. `src/main.tsx` гидрирует её (в dev метка пуста, рендер с нуля).
- `scripts/budget.mjs` проверяет `dist/` (JS первого экрана <= 120 КБ gzip, критичное первого экрана <= 300 КБ, мобильные картинки <= 250 КБ, видео) и входит в `npm run check`.

## Границы модулей

- `src/App.tsx` — порядок экранов и якоря `#top #price #works #faq #contacts`; шторка и `StickyCall` стоят вне `.page`.
- `src/sections/` — крупные блоки страницы, у каждого свой CSS-модуль рядом.
- `src/components/` — переиспользуемое: `Picture`, `Logo`, `CallButton`, `Curtain` (чистая логика в `curtain/state.ts`), `InkLine`, `PriceChapters`, `MotionProvider`.
- `src/styles/tokens.css` — единственный источник цветов, шрифтов, отступов; в секциях сырых цветов нет.
- Тесты в `tests/` (vitest + jsdom); чистые функции (`curtainReducer`, `shouldShowCurtain`) тестируются без DOM.

## Договорённости

- Рендер без `window`/`document`/`sessionStorage`; обращения только в эффектах и обработчиках.
- Motion: только `m.*` под `LazyMotion` (`MotionProvider`), не `motion.*`.
- Логотип — CSS-маска из `public/media/logo.svg`, не inline SVG.
- Факты не выдумываются: нет в `src/data/` и в `facts.md` сборки — нет и на странице.
- Решения и их причины — `docs/adr/`; словарь — `CONTEXT.md`; дизайн-система — `DESIGN.md`.

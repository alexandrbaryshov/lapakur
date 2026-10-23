# Лапакюр

Лендинг груминг-студии «Лапакюр» (Чебоксары): прайс по породам, работы, вопросы, карта и запись по телефону.

Vite + React + Motion, страница пререндерится при сборке и читается без JS.

## Запуск

Нужен Node.js 24+.

```sh
npm ci
npm run dev      # локально
npm run check    # типы, линтер, тесты, сборка и бюджет размеров
npm run build    # сборка в dist/
```

## Публикация

Каждый push в `master` проверяется и выкладывается на GitHub Pages workflow-ом [`.github/workflows/pages.yml`](.github/workflows/pages.yml).
Один раз в репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Устройство проекта — [docs/architecture.md](docs/architecture.md), решения — [docs/adr/](docs/adr/), дизайн-система — [DESIGN.md](DESIGN.md).

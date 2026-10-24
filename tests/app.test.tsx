import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import App, { HEAD_SCRIPT } from "../src/App";

afterEach(cleanup);

// Якоря и пункты меню — из interfaces.md («Секции») и истории R01 спецификации.
const ANCHORS = ["top", "price", "works", "faq", "contacts"];
const MENU = [
  ["Прайс", "#price"],
  ["Работы", "#works"],
  ["Вопросы", "#faq"],
  ["Контакты", "#contacts"],
];

describe("App — одна страница с якорной навигацией (R01)", () => {
  it("рендерит секции с якорями #top, #price, #works, #faq, #contacts в этом порядке", () => {
    const { container } = render(<App />);
    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id).filter((id) => ANCHORS.includes(id));
    expect(ids).toEqual(ANCHORS);
  });

  it("меню Прайс · Работы · Вопросы · Контакты ведёт к секциям", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    const links = within(nav).getAllByRole("link");
    const pairs = links.map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    for (const [label, href] of MENU) expect(pairs).toContainEqual([label, href]);
  });

  it("рендерится на сервере (пререндер для первой отрисовки и работы без JS)", () => {
    const html = renderToString(<App />);
    for (const id of ANCHORS) expect(html).toContain(`id="${id}"`);
  });
});

// Медленная сеть на iPhone: встроенный скрипт внутри разметки ждёт таблицу стилей, и пока разбор стоит,
// WebKit заранее грузит картинки дальше по разметке — и ленивые <picture> ниже первого экрана тоже
// (под шторкой они отнимали полосу у первого экрана и видео обложки). Флаги <html> ставит HEAD_SCRIPT в <head>.
describe("встроенные скрипты — только в <head>", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-curtain");
    document.documentElement.removeAttribute("data-sheets");
  });

  it("в разметке страницы нет исполняемых скриптов (JSON-LD — не скрипт)", () => {
    const doc = document.implementation.createHTMLDocument("ssr");
    doc.body.innerHTML = renderToString(<App />);
    const scripts = [...doc.querySelectorAll("script")].filter((s) => s.type !== "application/ld+json");
    expect(scripts).toHaveLength(0);
  });

  it("HEAD_SCRIPT при первом заходе прячет листы прайса и ставит покров шторки", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    sessionStorage.clear(); // App выше уже показывал шторку в этой «вкладке»
    new Function(HEAD_SCRIPT)();
    expect(document.documentElement.hasAttribute("data-sheets")).toBe(true);
    expect(document.documentElement.getAttribute("data-curtain")).toBe("pending");
  });

  it("в index.html метка скрипта стоит в <head>", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const head = /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? "";
    expect(head).toContain("<!--head-script-->");
  });
});

describe("index.html", () => {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");

  it("русский язык, viewport, точка монтирования для пререндера", () => {
    expect(html).toMatch(/<html lang="ru">/);
    expect(html).toMatch(/name="viewport"/);
    expect(html).toMatch(/<div id="root"><!--app-html--><\/div>/);
  });

  it("логотип из конвейера медиа — фавикон", () => {
    expect(html).toMatch(/<link rel="icon" href="\/media\/logo\.svg" type="image\/svg\+xml"/);
  });
});

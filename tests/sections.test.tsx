import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import App from "../src/App";
import { FAQ } from "../src/data/faq";
import { PRICE_GROUPS, formatPrice } from "../src/data/prices";
import { REVIEWS } from "../src/data/reviews";
import { WORKS } from "../src/data/works";

// Ожидания — из тикета 04, spec.md (истории 16–28, 33, 36) и facts.md.
// Литералы (телефон, адрес, сноски, цены глав, строки прайса) взяты из facts.md, а не из кода.
// Страница открывается с якорем в адресе — по R09.2 шторки тогда нет.

const PHONE_HREF = "tel:+79033581161";
const PHONE_DISPLAY = "+7 (903) 358-11-61";
const ADDRESS = "просп. 9-й Пятилетки, 15, Чебоксары";
const HOURS = "ежедневно, 10:00–18:00";
const ORG_URL = "https://yandex.ru/maps/org/lapakyur/199810306793/";
const REVIEWS_URL = "https://yandex.ru/maps/org/lapakyur/199810306793/reviews/";

const flat = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

// ── IntersectionObserver под управлением теста ──
type FakeEntry = Pick<IntersectionObserverEntry, "target" | "isIntersecting" | "boundingClientRect" | "intersectionRatio">;

class FakeObserver {
  static all: FakeObserver[] = [];
  elements = new Set<Element>();
  constructor(
    public callback: (entries: FakeEntry[], observer: FakeObserver) => void,
    public options?: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  observe(el: Element) {
    this.elements.add(el);
  }
  unobserve(el: Element) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
  }
  takeRecords() {
    return [];
  }
}

function observed(inside: Element) {
  return FakeObserver.all.flatMap((o) => [...o.elements]).filter((el) => inside === el || inside.contains(el));
}

/** Сообщить наблюдателям, что элемент вошёл в экран или ушёл из него (ушёл вверх — top < 0). */
function intersect(el: Element, isIntersecting: boolean, top = isIntersecting ? 0 : -2000) {
  const rect = { top, bottom: top + 400, left: 0, right: 400, width: 400, height: 400, x: 0, y: top } as DOMRectReadOnly;
  act(() => {
    for (const o of FakeObserver.all) {
      if (o.elements.has(el)) o.callback([{ target: el, isIntersecting, boundingClientRect: rect, intersectionRatio: isIntersecting ? 1 : 0 }], o);
    }
  });
}

async function flushPromises() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function renderPage() {
  window.history.replaceState(null, "", "/#price");
  return render(<App />);
}

function section(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`нет секции #${id}`);
  return el;
}

beforeEach(() => {
  FakeObserver.all = [];
  window.sessionStorage.clear();
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  // сеть в тестах не трогаем: сервер карт «доступен»
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

// ───────────────────────── прайс ─────────────────────────

describe("Прайс (#price, R16–R18)", () => {
  it("весь прайс тремя листами: 31 строка, каждая цена, время и ставка за час из данных", () => {
    renderPage();
    const price = section("price");
    const tables = within(price).getAllByRole("table");
    expect(tables).toHaveLength(3);

    let rows = 0;
    PRICE_GROUPS.forEach((group, i) => {
      const body = tables[i].querySelectorAll("tbody tr");
      expect(body).toHaveLength(group.rows.length);
      group.rows.forEach((row, j) => {
        const tr = body[j];
        expect(flat(tr.querySelector("th")?.textContent)).toBe(row.breed);
        const cells = [...tr.querySelectorAll("td[data-price]")].map((td) => td.textContent ?? "");
        expect(cells).toHaveLength(row.cells.length);
        row.cells.forEach((cell, k) => expect(cells[k]).toContain(formatPrice(cell)));
        if (row.duration) expect(tr.textContent).toContain(row.duration);
        if (row.hourly) expect(tr.textContent).toContain(formatPrice({ amount: row.hourly }));
        rows += 1;
      });
    });
    expect(rows).toBe(31);
  });

  it("строки сверены с фото прайса (facts.md): Ши-тцу, Самоед, Пудель от 45 см, Алабай", () => {
    renderPage();
    const price = section("price");
    const rowOf = (breed: string) =>
      [...price.querySelectorAll("tbody tr")].find((tr) => flat(tr.querySelector("th")?.textContent) === breed);
    const text = (breed: string) => flat(rowOf(breed)?.textContent).replace(/\u00a0/g, " ");
    expect(text("Ши-тцу")).toMatch(/1800 ₽.*2200 ₽.*2000 ₽/);
    expect(text("Самоед")).toContain("5 часов");
    expect(text("Самоед")).toContain("от 3000 ₽");
    expect(text("Самоед")).toContain("1400 ₽");
    expect(text("Пудель от 45 см")).toContain("3500 ₽");
    expect(text("Алабай")).toContain("от 5000 ₽");
  });

  it("сноски листов дословно", () => {
    renderPage();
    const text = flat(section("price").textContent);
    expect(text).toContain("Всё что входит в комплекс, кроме стрижки корпуса (спинки)");
    expect(text).toContain(
      "Собака должна быть СВЕЖЕПОМЫТОЙ. Особенно тщательно мыть голову, уши, лапы. (От этого зависит качество стрижки)",
    );
  });

  it("четыре главы с ценами 2200 / 1700 / 1800 / 2200 ₽ и фото процедуры у каждой", () => {
    renderPage();
    const price = section("price");
    const text = flat(price.textContent).replace(/\u00a0/g, " ");
    for (const [name, amount] of [
      ["Бишон", "2200 ₽"],
      ["Йорк", "1700 ₽"],
      ["Шпиц", "1800 ₽"],
      ["Пудель", "2200 ₽"],
    ]) {
      expect(within(price).getByRole("heading", { level: 3, name })).toBeTruthy();
      expect(text).toMatch(new RegExp(`${name} · комплекс с мытьём\\s*${amount}`));
    }
    const srcsets = [...price.querySelectorAll("img")].map((img) => img.getAttribute("srcset") ?? "");
    for (const key of ["price-bichon", "price-yorkie", "price-spitz", "price-poodle"]) {
      expect(srcsets.some((s) => s.includes(`media/${key}-`)), key).toBe(true);
    }
  });
});

// ───────────────────────── работы ─────────────────────────

describe("Ваши довольные питомцы (#works, R19)", () => {
  it("6 настоящих фото в рамках с подписью породы", () => {
    renderPage();
    const works = section("works");
    expect(within(works).getByRole("heading", { level: 2, name: "Ваши довольные питомцы" })).toBeTruthy();
    const figures = works.querySelectorAll("figure");
    expect(figures).toHaveLength(6);
    const captions = [...figures].map((f) => flat(f.querySelector("figcaption")?.textContent)).sort();
    expect(captions).toEqual(WORKS.map((w) => w.breed).sort());
    const srcsets = [...works.querySelectorAll("img")].map((img) => img.getAttribute("srcset") ?? "");
    for (const work of WORKS) expect(srcsets.some((s) => s.includes(`media/${work.media}-`)), work.media).toBe(true);
  });

  it("нажатие открывает фото крупнее; закрывают Esc, крестик и нажатие вне фото; фокус возвращается", async () => {
    renderPage();
    const works = section("works");
    const figure = [...works.querySelectorAll("figure")].find((f) => flat(f.querySelector("figcaption")?.textContent) === "Бишон-фризе");
    const trigger = within(figure!).getByRole("button");

    // Esc
    fireEvent.click(trigger);
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img").getAttribute("srcset")).toContain("works-bichon");
    expect(flat(dialog.textContent)).toContain("Бишон-фризе");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect(document.activeElement).toBe(trigger);

    // крестик
    fireEvent.click(trigger);
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });

    // нажатие на само фото не закрывает, вне фото — закрывает
    fireEvent.click(trigger);
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("img"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.click(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  });

  it("рамка-приглашение открывает обложку; без камеры — выбор фото из галереи; Esc закрывает, фокус возвращается", async () => {
    renderPage();
    const works = section("works");
    const invite = within(works).getByRole("button", { name: /Сфотографировать питомца/ });
    expect(invite.getAttribute("aria-haspopup")).toBe("dialog");
    // заголовок — над выкройкой обложки, под ней — абзац и призыв
    const heading = within(invite).getByText("Ваш питомец на обложке журнала");
    const cover = invite.querySelector("svg")!;
    expect(heading.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(flat(invite.textContent)).not.toContain("Ваш питомец — на обложке");
    // шесть кадров эссе — по-прежнему фотографии работ, приглашение — не кадр
    expect(works.querySelectorAll("figure")).toHaveLength(6);

    fireEvent.click(invite);
    const dialog = await screen.findByRole("dialog", { name: "Обложка «Лапакюр»" });
    // в jsdom камеры нет — окно сразу предлагает фото из галереи
    expect(await within(dialog).findByText(/Камера недоступна/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Выбрать фото" })).toBeTruthy();
    expect(dialog.querySelector('input[type="file"][accept="image/*"]')).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect(document.activeElement).toBe(invite);
  });
});

// ───────────────────────── вопросы ─────────────────────────

describe("Вопросы (#faq, R20)", () => {
  it("8 вопросов; ответы раскрываются по одному (aria-expanded)", () => {
    renderPage();
    const faq = section("faq");
    const buttons = within(faq).getAllByRole("button");
    expect(buttons).toHaveLength(8);
    buttons.forEach((b, i) => {
      expect(b.tagName).toBe("BUTTON");
      expect(flat(b.textContent)).toBe(FAQ[i].q);
      expect(b.getAttribute("aria-expanded")).toBe("false");
    });
    const panel = (b: HTMLElement) => document.getElementById(b.getAttribute("aria-controls") ?? "")!;
    expect(panel(buttons[0])).not.toBeNull();
    expect(panel(buttons[0]).hasAttribute("inert")).toBe(true);

    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");
    expect(panel(buttons[0]).hasAttribute("inert")).toBe(false);
    expect(flat(panel(buttons[0]).textContent)).toBe(FAQ[0].a);

    fireEvent.click(buttons[3]);
    expect(buttons[3].getAttribute("aria-expanded")).toBe("true");
    expect(buttons[0].getAttribute("aria-expanded")).toBe("false");
    expect(panel(buttons[0]).hasAttribute("inert")).toBe(true);
    expect(buttons.filter((b) => b.getAttribute("aria-expanded") === "true")).toHaveLength(1);

    fireEvent.click(buttons[3]);
    expect(buttons.every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
  });
});

// ───────────────────────── визит ─────────────────────────

describe("Визит (#contacts, R21–R23)", () => {
  it("Яндекс Карта грузится, только когда секция рядом; виджет по координатам и id организации", () => {
    renderPage();
    const contacts = section("contacts");
    expect(contacts.querySelector("iframe")).toBeNull();
    const fallback = within(contacts).getByRole("link", { name: "Открыть в Яндекс Картах" });
    expect(fallback.getAttribute("href")).toBe(ORG_URL);

    const targets = observed(contacts);
    expect(targets.length).toBeGreaterThan(0);
    intersect(targets[0], true);
    const iframe = contacts.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const src = iframe!.getAttribute("src") ?? "";
    expect(src).toMatch(/^https:\/\/yandex\.ru\/map-widget\/v1\/?\?/);
    expect(src).toContain("oid=199810306793");
    expect(decodeURIComponent(src)).toContain("47.280633,56.097437");
    expect(iframe!.getAttribute("title")).toBeTruthy();
  });

  it("сервер карт недоступен — iframe убирается, остаётся заглушка с адресом и ссылкой", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    renderPage();
    const contacts = section("contacts");
    intersect(observed(contacts)[0], true);
    // браузер шлёт load и для своей страницы ошибки в iframe
    fireEvent.load(contacts.querySelector("iframe")!);
    await flushPromises();
    expect(contacts.querySelector("iframe")).toBeNull();
    const fallback = within(contacts).getByRole("link", { name: "Открыть в Яндекс Картах" });
    expect(fallback.getAttribute("href")).toBe(ORG_URL);
    expect(flat(fallback.closest("[data-map]")?.textContent)).toContain(ADDRESS);
  });

  it("заглушка карты — адрес и ссылка, без служебных координат", () => {
    renderPage();
    const map = section("contacts").querySelector("[data-map]")!;
    const text = flat(map.textContent);
    expect(text).toContain(ADDRESS);
    expect(within(map as HTMLElement).getByRole("link", { name: "Открыть в Яндекс Картах" }).getAttribute("href")).toBe(ORG_URL);
    // координаты студии из facts.md: 56.097437, 47.280633
    expect(text).not.toMatch(/56[.,]097437|47[.,]280633/);
  });

  it("виджет так и не загрузился — по таймауту остаётся заглушка", () => {
    vi.useFakeTimers();
    renderPage();
    const contacts = section("contacts");
    intersect(observed(contacts)[0], true);
    expect(contacts.querySelector("iframe")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(contacts.querySelector("iframe")).toBeNull();
    expect(within(contacts).getByRole("link", { name: "Открыть в Яндекс Картах" })).toBeTruthy();
  });

  it("загруженная карта показывается и остаётся", async () => {
    vi.useFakeTimers();
    renderPage();
    const contacts = section("contacts");
    intersect(observed(contacts)[0], true);
    fireEvent.load(contacts.querySelector("iframe")!);
    await flushPromises();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(contacts.querySelector("[data-map]")?.getAttribute("data-map")).toBe("ready");
    expect(contacts.querySelector("iframe")).not.toBeNull();
  });

  it("5 отзывов дословно с именем и датой и ссылка на все отзывы", () => {
    renderPage();
    const contacts = section("contacts");
    const quotes = contacts.querySelectorAll("blockquote");
    expect(quotes).toHaveLength(5);
    REVIEWS.forEach((review, i) => {
      expect(quotes[i].textContent).toBe(review.text);
      const caption = flat(quotes[i].closest("figure")?.querySelector("figcaption")?.textContent);
      expect(caption).toContain(review.author);
      expect(caption).toContain(review.date);
    });
    const all = within(contacts).getByRole("link", { name: "Все отзывы на Яндекс Картах" });
    expect(all.getAttribute("href")).toBe(REVIEWS_URL);
  });

  it("контакты для записи: телефон кликабелен, адрес ведёт в Яндекс Карты, часы", () => {
    renderPage();
    const contacts = section("contacts");
    const phone = within(contacts)
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === PHONE_HREF && flat(a.textContent) === PHONE_DISPLAY);
    expect(phone).toBeDefined();
    const address = within(contacts)
      .getAllByRole("link")
      .find((a) => a.getAttribute("href") === ORG_URL && flat(a.textContent) === ADDRESS);
    expect(address).toBeDefined();
    expect(flat(contacts.textContent)).toContain(HOURS);
  });

  it("«Построить маршрут» — Яндекс Карты, маршрут от места посетителя до студии", () => {
    renderPage();
    const route = within(section("contacts")).getByRole("link", { name: /^Построить маршрут/ });
    // начало маршрута пустое (rtext=~…) — Яндекс Карты ведут от текущего местоположения
    expect(route.getAttribute("href")).toBe("https://yandex.ru/maps/?rtext=~56.097437,47.280633&rtt=auto");
    expect(route.getAttribute("target")).toBe("_blank");
  });
});

// ───────────────────────── подвал и липкая кнопка ─────────────────────────

describe("Подвал", () => {
  it("логотип, телефон, адрес, часы", () => {
    renderPage();
    const footer = screen.getByRole("contentinfo");
    expect(footer.querySelector("[data-logo]")).not.toBeNull();
    expect(within(footer).getAllByRole("link").some((a) => a.getAttribute("href") === PHONE_HREF)).toBe(true);
    const text = flat(footer.textContent);
    expect(text).toContain(PHONE_DISPLAY);
    expect(text).toContain(ADDRESS);
    expect(text).toContain(HOURS);
  });
});

describe("Липкая кнопка-звонок (история 16)", () => {
  it("в пререндере есть, но скрыта и недоступна", () => {
    const doc = document.implementation.createHTMLDocument("ssr");
    doc.body.innerHTML = renderToString(<App />);
    const sticky = doc.querySelector("[data-sticky-call]");
    expect(sticky).not.toBeNull();
    expect(sticky!.getAttribute("aria-hidden")).toBe("true");
    expect(sticky!.querySelector(`a[href="${PHONE_HREF}"]`)).not.toBeNull();
  });

  it("появляется после обложки и прячется у подвала", () => {
    renderPage();
    const sticky = document.querySelector<HTMLElement>("[data-sticky-call]")!;
    const hidden = () => sticky.getAttribute("aria-hidden") === "true" && sticky.hasAttribute("inert");
    expect(hidden()).toBe(true);

    intersect(section("top"), false, -2000);
    expect(hidden()).toBe(false);
    expect(within(sticky).getByRole("link").getAttribute("href")).toBe(PHONE_HREF);

    intersect(screen.getByRole("contentinfo"), true);
    expect(hidden()).toBe(true);

    intersect(screen.getByRole("contentinfo"), false, 2000);
    expect(hidden()).toBe(false);

    intersect(section("top"), true);
    expect(hidden()).toBe(true);
  });
});

// ───────────────────────── мета ─────────────────────────

describe("Мета, Open Graph и JSON-LD (история 36)", () => {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const meta = (attr: "name" | "property", key: string) =>
    new RegExp(`<meta\\s+${attr}="${key.replace(/[.:]/g, "\\$&")}"\\s+content="([^"]*)"`).exec(html)?.[1];

  it("description и Open Graph из фактов студии", () => {
    const description = meta("name", "description") ?? "";
    expect(description).toContain("Чебоксар");
    expect(description).toContain(PHONE_DISPLAY);
    expect(meta("property", "og:title")).toContain("Лапакюр");
    expect(meta("property", "og:description")).toBeTruthy();
    expect(meta("property", "og:type")).toBe("website");
    expect(meta("property", "og:locale")).toBe("ru_RU");
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
  });

  it("картинка для пересылки — og-image из конвейера медиа", () => {
    const image = meta("property", "og:image") ?? "";
    expect(image).toMatch(/og-image-1200\.jpg$/);
    expect(existsSync(join(process.cwd(), "public", image.replace(/^\.?\//, "")))).toBe(true);
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:height")).toBe("630");
  });

  it("JSON-LD LocalBusiness только из facts.md", () => {
    const doc = document.implementation.createHTMLDocument("ssr");
    doc.body.innerHTML = renderToString(<App />);
    const script = doc.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent ?? "{}");
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("LocalBusiness");
    expect(data.name).toBe("Лапакюр");
    expect(data.telephone).toBe("+79033581161");
    expect(data.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "просп. 9-й Пятилетки, 15",
      addressLocality: "Чебоксары",
    });
    expect(data.geo).toEqual({ "@type": "GeoCoordinates", latitude: 56.097437, longitude: 47.280633 });
    expect(data.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "10:00",
        closes: "18:00",
      },
    ]);
    expect(data.hasMap).toBe(ORG_URL);
    const allowed = ["@context", "@type", "name", "description", "telephone", "address", "geo", "openingHoursSpecification", "hasMap", "image", "url"];
    for (const key of Object.keys(data)) expect(allowed, `лишнее поле ${key}`).toContain(key);
  });
});

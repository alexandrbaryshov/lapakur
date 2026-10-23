import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import App from "../src/App";
import { PRICE_GROUPS, formatPrice } from "../src/data/prices";

// Прайс на одной странице (тикет F4, spec.md истории 38–39): главы, фото и три карточки листов;
// нажатие открывает окно листа с полной таблицей. Без JS листы видны в разметке под карточками.
// Ожидания — из тикета и facts.md: составы листов посчитаны по фото прайса вручную
// (комплекс 1 — 8 пород; комплекс 2 — йорки, шпицы, пудели: 3 породы; экспресс-линька — 14 пород).

const PHONE_HREF = "tel:+79033581161";
const flat = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
  window.history.replaceState(null, "", "/");
});

function renderPage() {
  window.history.replaceState(null, "", "/#price");
  return render(<App />);
}

const price = () => document.getElementById("price")!;
const cards = () => within(price()).getAllByRole("button", { name: /Открыть лист/ });

describe("Прайс в пререндере (без JS)", () => {
  const doc = document.implementation.createHTMLDocument("ssr");
  doc.body.innerHTML = renderToString(<App />);
  const section = doc.getElementById("price")!;

  it("все 31 строка и каждая цена листов — в разметке #price", () => {
    expect(section.querySelectorAll("tbody tr")).toHaveLength(31);
    const text = flat(section.textContent);
    for (const group of PRICE_GROUPS) {
      for (const row of group.rows) {
        const tr = [...section.querySelectorAll("tbody tr")].find((r) => flat(r.querySelector("th")?.textContent) === row.breed);
        expect(tr, row.breed).toBeDefined();
        const cells = [...tr!.querySelectorAll("td[data-price]")].map((td) => flat(td.textContent));
        row.cells.forEach((cell, k) => expect(cells[k]).toContain(flat(formatPrice(cell))));
        if (row.duration) expect(flat(tr!.textContent)).toContain(row.duration);
      }
      for (const note of group.footnotes) expect(text).toContain(flat(note));
    }
  });

  it("карточки листов — ссылки на листы под ними: без JS лист открывается переходом", () => {
    const links = [...section.querySelectorAll<HTMLAnchorElement>('a[href^="#price-sheet-"]')];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(PRICE_GROUPS.map((g) => `#price-sheet-${g.id}`));
    for (const group of PRICE_GROUPS) {
      const sheet = doc.getElementById(`price-sheet-${group.id}`);
      expect(sheet, group.id).not.toBeNull();
      expect(sheet!.hasAttribute("hidden")).toBe(false);
      expect(sheet!.querySelectorAll("tbody tr")).toHaveLength(group.rows.length);
    }
  });
});

describe("Карточки листов", () => {
  it("три кнопки: название листа, состав и число пород", () => {
    renderPage();
    const buttons = cards();
    expect(buttons).toHaveLength(3);
    const names = buttons.map((b) => flat(b.textContent));
    expect(names[0]).toContain("Комплекс и гигиеническая стрижка");
    expect(names[0]).toMatch(/Бишон/i);
    expect(names[0]).toContain("8 пород");
    expect(names[1]).toMatch(/йорки, шпицы, пудели/i);
    expect(names[1]).toContain("3 породы");
    expect(names[2]).toContain("Экспресс-линька");
    expect(names[2]).toContain("14 пород");
    for (const b of buttons) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("aria-haspopup")).toBe("dialog");
    }
  });
});

describe("Окно листа", () => {
  it("полная таблица листа, сноски дословно и «Записаться»; фокус в окне, прокрутка заперта", async () => {
    renderPage();
    for (const [i, group] of PRICE_GROUPS.entries()) {
      const trigger = cards()[i];
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog", { name: group.title });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      const rows = within(dialog).getByRole("table").querySelectorAll("tbody tr");
      expect(rows).toHaveLength(group.rows.length);
      group.rows.forEach((row, j) => {
        expect(flat(rows[j].querySelector("th")?.textContent)).toBe(row.breed);
        const cells = [...rows[j].querySelectorAll("td[data-price]")].map((td) => flat(td.textContent));
        row.cells.forEach((cell, k) => expect(cells[k]).toContain(flat(formatPrice(cell))));
        if (row.duration) expect(flat(rows[j].textContent)).toContain(row.duration);
        if (row.hourly) expect(flat(rows[j].textContent)).toContain(`${row.hourly} ₽ — 1 час работы`);
      });
      for (const note of group.footnotes) expect(flat(dialog.textContent)).toContain(flat(note));
      const call = within(dialog).getAllByRole("link").find((a) => a.getAttribute("href") === PHONE_HREF);
      expect(call && flat(call.textContent)).toContain("Записаться");

      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.documentElement.style.overflow).toBe("hidden");

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
      expect(document.activeElement).toBe(trigger);
      expect(document.documentElement.style.overflow).not.toBe("hidden");
    }
  });

  it("закрывают крестик и нажатие вне окна; нажатие внутри окна не закрывает", async () => {
    renderPage();
    const trigger = cards()[2];

    fireEvent.click(trigger);
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("table"));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    const backdrop = document.querySelector("[data-sheet-backdrop]")!;
    expect(backdrop.contains(dialog)).toBe(true);
    fireEvent.click(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab не выводит фокус из окна", async () => {
    renderPage();
    fireEvent.click(cards()[0]);
    const dialog = await screen.findByRole("dialog");
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    expect(focusables.length).toBeGreaterThan(1);
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });
});

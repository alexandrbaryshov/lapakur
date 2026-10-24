import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import App from "../src/App";
import CurtainPanel from "../src/components/curtain/CurtainPanel";
import { Curtain, CURTAIN_BOOT_SCRIPT, CURTAIN_COVER_TIMEOUT_MS } from "../src/components/Curtain";
import { MotionProvider } from "../src/components/MotionProvider";

// Ожидания — из spec.md (истории 3–15, 32), тикета 03 и interfaces.md:
// пять услуг на главном, шапка-дидон с названием, подзаголовок макета дословно,
// «Записаться» — tel:+79033581161 с собакой у телефона и номером, постер первым экраном,
// видео не в пререндере, шторки без JS нет, шторка не запирает сайт.

const SERVICES = ["Стрижка (груминг)", "Подстрижка когтей", "Мытьё", "Окраска", "Вычёсывание"];
const TAGLINE = "Премиум-студия груминга в Чебоксарах";
const CURTAIN_TEXT = "Узнайте, чем занимается ваш питомец";
const PHONE_HREF = "tel:+79033581161";
const PHONE_SHORT = "+7 903 358-11-61";

const flat = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

function ssrDocument() {
  const doc = document.implementation.createHTMLDocument("ssr");
  doc.body.innerHTML = renderToString(<App />);
  return doc;
}

// ── минимальный вычислитель sizes: какой ширины кандидат выберет экран (width × dpr) ──
function slotWidth(sizes: string, width: number, dpr: number) {
  for (const part of sizes.split(",").map((s) => s.trim())) {
    const m = /^(.*\))\s+(\S+)$/.exec(part);
    const [cond, len] = m ? [m[1], m[2]] : ["", part];
    const ok = (cond.match(/\(([^)]+)\)/g) ?? []).every((c) => {
      const [, feature, value] = /\(\s*([\w-]+)\s*:\s*([\d.]+)/.exec(c) ?? [];
      const v = Number(value);
      if (feature === "max-width") return width <= v;
      if (feature === "min-width") return width >= v;
      if (feature === "min-resolution") return dpr >= v;
      return false;
    });
    if (!ok) continue;
    return len.endsWith("vw") ? (Number(len.slice(0, -2)) / 100) * width : Number(len.replace("px", ""));
  }
  return width;
}

function chosenCandidate(srcset: string, sizes: string, width: number, dpr: number) {
  const need = slotWidth(sizes, width, dpr) * dpr;
  const widths = srcset.split(",").map((c) => Number(/(\d+)w\s*$/.exec(c.trim())?.[1])).sort((a, b) => a - b);
  return widths.find((w) => w >= need) ?? widths[widths.length - 1];
}

describe("обложка в пререндере (первая отрисовка и работа без JS)", () => {
  it("шапка — заголовок первого уровня с названием студии", () => {
    const h1 = ssrDocument().querySelector("#top h1");
    expect(flat(h1?.textContent)).toBe("Лапакюр");
  });

  it("подзаголовок макета дословно", () => {
    const top = ssrDocument().getElementById("top");
    expect(flat(top?.textContent)).toContain(TAGLINE);
  });

  it("все пять услуг названы на главном экране", () => {
    const top = ssrDocument().getElementById("top");
    const text = flat(top?.textContent);
    for (const service of SERVICES) expect(text).toContain(service);
  });

  it("постер обложки грузится первым и телефону достаётся не шире 800w", () => {
    const img = ssrDocument().querySelector<HTMLImageElement>("#top img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("fetchpriority")).toBe("high");
    expect(img!.getAttribute("loading")).toBe("eager");
    const srcset = img!.getAttribute("srcset") ?? "";
    const sizes = img!.getAttribute("sizes") ?? "";
    expect(srcset).toContain("hero-poster");
    expect(chosenCandidate(srcset, sizes, 390, 3)).toBeLessThanOrEqual(800);
    expect(chosenCandidate(srcset, sizes, 390, 2)).toBeLessThanOrEqual(800);
    expect(chosenCandidate(srcset, sizes, 1440, 1)).toBeGreaterThanOrEqual(480);
  });

  // G02 (spec.md, история 37): голова в тюрбане впереди шапки — шапка в два слоя: заголовок под
  // пластиной и его копия над ней с маской, вырезающей тюрбан. Маска — статичная картинка конвейера
  // медиа, поэтому эффект есть уже в пререндере: без JS и при reduced-motion, на постере.
  it("шапка в два слоя: заголовок под пластиной и копия над ней с маской тюрбана из конвейера медиа", () => {
    const top = ssrDocument().getElementById("top")!;
    const h1 = top.querySelector("h1")!;
    const layers = [...top.querySelectorAll<HTMLElement>("[data-masthead]")];
    expect(layers.map((el) => el.getAttribute("data-masthead"))).toEqual(["back", "front"]);
    const [back, front] = layers;
    expect(back).toBe(h1);
    // копия — только картинка для глаза: та же надпись, скрыта от чтения с экрана, вне фокуса
    expect(front.tagName).not.toBe("H1");
    expect(front.getAttribute("aria-hidden")).toBe("true");
    expect(front.hasAttribute("tabindex")).toBe(false);
    expect(flat(front.textContent)).toBe(flat(h1.textContent));
    // маска — лёгкий PNG из public/media (ключ hero-mask конвейера)
    const style = front.getAttribute("style") ?? "";
    const url = /(?:^|;)\s*mask-image:\s*url\("?([^")]+)"?\)/.exec(style)?.[1];
    expect(url).toMatch(/^media\/hero-mask-\d+\.png$/);
    expect(style).toMatch(/-webkit-mask-image:\s*url\(/); // Safari до 15.4
    const file = join(process.cwd(), "public", url!);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThanOrEqual(15_000);
  });

  it("видео в пререндере нет — оно подключается после load", () => {
    expect(ssrDocument().querySelector("video")).toBeNull();
  });

  it("шторки без JS нет: ни надписи, ни разметки шторки", () => {
    const doc = ssrDocument();
    expect(doc.body.textContent).not.toContain(CURTAIN_TEXT);
    expect(doc.querySelector('[role="dialog"]')).toBeNull();
  });

  it("«Записаться» — ссылка на телефон студии с собакой у телефона и номером", () => {
    const doc = ssrDocument();
    const link = [...doc.querySelectorAll<HTMLAnchorElement>("header a")].find((a) => flat(a.textContent).startsWith("Записаться"));
    expect(link).toBeDefined();
    expect(link!.getAttribute("href")).toBe(PHONE_HREF);
    expect(flat(link!.textContent)).toContain(PHONE_SHORT);
    expect(link!.querySelector("img")?.getAttribute("srcset")).toContain("call-dog");
  });

  it("в шапке есть логотип студии", () => {
    const doc = ssrDocument();
    const home = doc.querySelector<HTMLAnchorElement>('header a[href="#top"]');
    expect(home?.getAttribute("aria-label")).toContain("Лапакюр");
    expect(home?.querySelector("[data-logo]")).not.toBeNull();
  });
});

describe("файлы медиа, на которые ссылаются стили, есть в конвейере", () => {
  it("каждый url(/media/…) в src/**/*.css лежит в public/media", () => {
    const root = join(process.cwd(), "src");
    const cssFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".css")) cssFiles.push(full);
      }
    };
    walk(root);
    const urls = cssFiles.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/url\("\/(media\/[^"]+)"\)/g)].map((m) => m[1]));
    expect(urls).toContain("media/logo.svg");
    expect(urls).toContain("media/curtain-800.avif");
    for (const url of urls) expect(existsSync(join(process.cwd(), "public", url)), url).toBe(true);
  });
});

describe("шторка в браузере", () => {
  let reduced = true;

  beforeEach(() => {
    reduced = true;
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    document.documentElement.removeAttribute("data-curtain");
    document.documentElement.style.overflow = "";
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion") ? reduced : false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("при первом заходе встречает надписью и стрелкой, прокрутка заперта, страница под ней недоступна", async () => {
    const { container } = render(<App />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(CURTAIN_TEXT)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Открыть шторку" })).toBeTruthy();
    // замок прокрутки и inert ставят эффекты: панель шторки — ленивый чанк, её эффекты могут отработать
    // на шаг позже, чем она появилась в разметке
    await waitFor(() => expect(document.documentElement.style.overflow).toBe("hidden"));
    await waitFor(() => expect(container.querySelector(".page")?.hasAttribute("inert")).toBe(true));
  });

  it("кнопка со стрелкой открывает, после открытия страница листается", async () => {
    render(<App />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Открыть шторку" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    // замок снимает очистка эффекта панели — она тоже может отработать после ухода шторки из разметки
    await waitFor(() => expect(document.documentElement.style.overflow).not.toBe("hidden"));
  });

  it("после открытия фокус — на заголовке ЛАПАКЮР (без прокрутки), страница уже не inert", async () => {
    const focusCalls: { el: Element; options?: FocusOptions; pageInert: boolean }[] = [];
    const nativeFocus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      focusCalls.push({ el: this, options, pageInert: !!document.querySelector(".page[inert]") });
      nativeFocus.call(this, options);
    });
    render(<App />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Открыть шторку" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    const title = document.getElementById("top-title");
    expect(title?.tagName).toBe("H1");
    await waitFor(() => expect(document.activeElement).toBe(title));
    const call = focusCalls.find((c) => c.el === title);
    expect(call?.options).toEqual({ preventScroll: true });
    expect(call?.pageInert).toBe(false);
  });

  it("покров до гидрации ушёл по таймауту — шторка уже не выезжает, onShow не вызывается", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      // встроенный скрипт страницы при разборе HTML: первый заход — покров ставится
      new Function(CURTAIN_BOOT_SCRIPT)();
      expect(document.documentElement.getAttribute("data-curtain")).toBe("pending");
      // JS страницы так и не пришёл за время покрова
      vi.advanceTimersByTime(CURTAIN_COVER_TIMEOUT_MS);
    } finally {
      vi.useRealTimers();
    }
    const onShow = vi.fn();
    render(
      <MotionProvider>
        <Curtain onShow={onShow} />
      </MotionProvider>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onShow).not.toHaveBeenCalled();
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });

  it("Enter открывает шторку", async () => {
    render(<App />);
    await screen.findByRole("dialog");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  });

  it("прокрутка колесом открывает шторку", async () => {
    render(<App />);
    await screen.findByRole("dialog");
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120 }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
  });

  it("с якорем в адресе шторки нет", async () => {
    window.history.replaceState(null, "", "/#price");
    render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("второй раз в той же сессии шторки нет", async () => {
    const first = render(<App />);
    await screen.findByRole("dialog");
    first.unmount();
    render(<App />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

// ── жест: скорость отпускания считается по последним ~100 мс до pointerup (код-ревью ветки) ──

/** Событие указателя с заданной меткой времени (мс) — как его видит обработчик React. */
function pointer(target: Element, type: string, x: number, t: number) {
  const Ctor = (window.PointerEvent ?? window.MouseEvent) as typeof MouseEvent;
  const event = new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: 400, button: 0 });
  Object.defineProperty(event, "timeStamp", { value: t });
  if (!("pointerId" in event) || (event as PointerEvent).pointerId === undefined) {
    Object.defineProperty(event, "pointerId", { value: 1 });
  }
  Object.defineProperty(event, "pointerType", { value: "touch" });
  Object.defineProperty(event, "isPrimary", { value: true });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe("шторка: отпускание после паузы", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.style.overflow = "";
  });

  /** Протянуть шторку на 30 % ширины за 48 мс (быстро) и отпустить в момент `releaseAt`. */
  function dragAndRelease(releaseAt: number) {
    const opened = vi.fn();
    render(
      <MotionProvider>
        <CurtainPanel onOpened={opened} />
      </MotionProvider>,
    );
    const dialog = screen.getByRole("dialog");
    Object.defineProperty(dialog, "clientWidth", { configurable: true, value: 1000 });
    pointer(dialog, "pointerdown", 100, 1000);
    pointer(dialog, "pointermove", 200, 1016);
    pointer(dialog, "pointermove", 300, 1032);
    pointer(dialog, "pointermove", 400, 1048);
    pointer(dialog, "pointerup", 400, releaseAt);
    return { dialog, opened };
  }

  it("протянул быстро, замер ≥ 100 мс и отпустил до порога 35 % — шторка возвращается", async () => {
    const { dialog, opened } = dragAndRelease(1048 + 350);
    expect(dialog.getAttribute("data-phase")).toBe("closed");
    await new Promise((r) => setTimeout(r, 100));
    expect(opened).not.toHaveBeenCalled();
  });

  it("отпустил на ходу (резкое смахивание) — открывается, хотя сдвиг меньше порога", () => {
    const { dialog } = dragAndRelease(1060);
    expect(dialog.getAttribute("data-phase")).toBe("opening");
  });
});

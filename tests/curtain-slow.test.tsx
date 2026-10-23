import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import App from "../src/App";
import { CURTAIN_BOOT_SCRIPT, CURTAIN_COVER_TIMEOUT_MS } from "../src/components/Curtain";

// Медленная сеть (код-ревью ветки, Curtain.tsx + global.css): чанк панели шторки не успел
// загрузиться, а покров до гидрации уже ушёл по таймауту — страница не должна остаться inert
// под пустым местом. Чанк здесь «грузится» вечно.
vi.mock("../src/components/curtain/CurtainPanel", () => new Promise(() => {}));

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  document.documentElement.removeAttribute("data-curtain");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-curtain");
  document.documentElement.style.overflow = "";
});

describe("шторка на медленной сети", () => {
  it("покров ушёл по таймауту, пока чанк шторки грузится, — страница снова доступна", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    new Function(CURTAIN_BOOT_SCRIPT)();
    const { container } = render(<App />);
    const page = container.querySelector(".page")!;
    // шторку решили показать: страница под ней inert, панель ещё в пути
    expect(page.hasAttribute("inert")).toBe(true);
    expect(container.ownerDocument.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(CURTAIN_COVER_TIMEOUT_MS);
    });
    expect(page.hasAttribute("inert")).toBe(false);
    // покров растворился — метки покрова на <html> не осталось (по ней ждёт сквозная линия)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.documentElement.hasAttribute("data-curtain")).toBe(false);
  });
});

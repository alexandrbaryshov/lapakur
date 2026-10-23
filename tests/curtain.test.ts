// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  curtainReducer,
  shouldShowCurtain,
  initialCurtainState,
  OPEN_THRESHOLD,
  FLING_VELOCITY,
  CURTAIN_SESSION_KEY,
  type CurtainState,
} from "../src/components/curtain/state";
import { CURTAIN_BOOT_SCRIPT } from "../src/components/Curtain";

// Ожидания — из spec.md (истории 7–12, R09–R09.3, R41i) и interfaces.md («Компоненты»):
// порог открытия ≈ 35 % ширины, резкое смахивание открывает, отпускание до порога — возврат;
// кнопка/клавиатура/колесо/свайп открывают; при хэше и повторном показе в сессии шторки нет.

const at = (phase: CurtainState["phase"], progress = 0): CurtainState => ({ phase, progress });

describe("константы шторки", () => {
  it("порог открытия — 35 % ширины", () => {
    expect(OPEN_THRESHOLD).toBe(0.35);
  });
  it("скорость смахивания положительна (доли ширины в секунду)", () => {
    expect(FLING_VELOCITY).toBeGreaterThan(0);
  });
});

describe("curtainReducer", () => {
  it("начинает закрытой, без сдвига", () => {
    expect(initialCurtainState).toEqual({ phase: "closed", progress: 0 });
  });

  it("dragStart из closed переводит в dragging", () => {
    expect(curtainReducer(at("closed"), { type: "dragStart" }).phase).toBe("dragging");
  });

  it("dragMove ведёт шторку за пальцем и держит сдвиг в пределах 0…1", () => {
    const s = curtainReducer(at("dragging"), { type: "dragMove", progress: 0.2 });
    expect(s).toEqual({ phase: "dragging", progress: 0.2 });
    expect(curtainReducer(at("dragging"), { type: "dragMove", progress: 1.7 }).progress).toBe(1);
    expect(curtainReducer(at("dragging"), { type: "dragMove", progress: -0.4 }).progress).toBe(0);
  });

  it("отпустил на полпути до порога — шторка возвращается (closed, сдвиг 0)", () => {
    const s = curtainReducer(at("dragging", 0.2), { type: "release", progress: 0.2, velocity: 0 });
    expect(s).toEqual({ phase: "closed", progress: 0 });
  });

  it("дотянул дальше 35 % — открывается до конца", () => {
    const s = curtainReducer(at("dragging", 0.4), { type: "release", progress: 0.4, velocity: 0 });
    expect(s.phase).toBe("opening");
  });

  it("ровно на пороге — открывается", () => {
    const s = curtainReducer(at("dragging", 0.35), { type: "release", progress: 0.35, velocity: 0 });
    expect(s.phase).toBe("opening");
  });

  it("резкое смахивание вправо открывает даже с малым сдвигом", () => {
    const s = curtainReducer(at("dragging", 0.1), { type: "release", progress: 0.1, velocity: FLING_VELOCITY * 1.5 });
    expect(s.phase).toBe("opening");
  });

  it("резкое смахивание влево возвращает, даже если сдвиг за порогом", () => {
    const s = curtainReducer(at("dragging", 0.5), { type: "release", progress: 0.5, velocity: -FLING_VELOCITY * 1.5 });
    expect(s).toEqual({ phase: "closed", progress: 0 });
  });

  it("openRequest (кнопка, Enter/пробел, колесо, свайп) открывает из closed и из dragging", () => {
    expect(curtainReducer(at("closed"), { type: "openRequest" }).phase).toBe("opening");
    expect(curtainReducer(at("dragging", 0.1), { type: "openRequest" }).phase).toBe("opening");
  });

  it("settled завершает открытие: opening → open, сдвиг 1", () => {
    expect(curtainReducer(at("opening", 0.6), { type: "settled" })).toEqual({ phase: "open", progress: 1 });
  });

  it("открытая шторка больше не реагирует на жесты", () => {
    const open = at("open", 1);
    expect(curtainReducer(open, { type: "dragStart" })).toBe(open);
    expect(curtainReducer(open, { type: "openRequest" })).toBe(open);
    expect(curtainReducer(open, { type: "release", progress: 0, velocity: 0 })).toBe(open);
  });

  it("во время открытия жесты не перехватывают анимацию", () => {
    const opening = at("opening", 0.5);
    expect(curtainReducer(opening, { type: "dragStart" })).toBe(opening);
    expect(curtainReducer(opening, { type: "dragMove", progress: 0.1 })).toBe(opening);
  });

  it("dragMove и release вне перетаскивания ничего не меняют", () => {
    const closed = at("closed");
    expect(curtainReducer(closed, { type: "dragMove", progress: 0.5 })).toBe(closed);
    expect(curtainReducer(closed, { type: "release", progress: 0.9, velocity: 9 })).toBe(closed);
  });
});

describe("скрипт до гидрации решает так же, как shouldShowCurtain", () => {
  type Visit = { hash: string; sessionFlag: boolean; navigationType?: string };
  const run = ({ hash, sessionFlag, navigationType }: Visit) => {
    const attrs: Record<string, string> = {};
    const env = {
      location: { hash },
      sessionStorage: { getItem: (key: string) => (sessionFlag && key === CURTAIN_SESSION_KEY ? "1" : null) },
      performance: { getEntriesByType: () => (navigationType ? [{ type: navigationType }] : []) },
      document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
    };
    // таймер покрова здесь не нужен — проверяется только решение «показывать ли»
    new Function("location", "sessionStorage", "performance", "document", "setTimeout", CURTAIN_BOOT_SCRIPT)(
      env.location,
      env.sessionStorage,
      env.performance,
      env.document,
      () => 0,
    );
    return attrs["data-curtain"] === "pending";
  };

  const visits: Visit[] = [];
  for (const hash of ["", "#", "#price", "#top"])
    for (const sessionFlag of [false, true])
      for (const navigationType of [undefined, "navigate", "reload", "back_forward", "prerender"])
        visits.push({ hash, sessionFlag, navigationType });

  it.each(visits)("%o", (visit) => {
    expect(run(visit)).toBe(shouldShowCurtain(visit));
  });
});

describe("shouldShowCurtain", () => {
  const first = { hash: "", sessionFlag: false, navigationType: "navigate" };

  it("первое открытие в сессии — шторка есть", () => {
    expect(shouldShowCurtain(first)).toBe(true);
  });

  it("переход по ссылке с якорем (#price, #top) — шторки нет", () => {
    expect(shouldShowCurtain({ ...first, hash: "#price" })).toBe(false);
    expect(shouldShowCurtain({ ...first, hash: "#top" })).toBe(false);
  });

  it("пустой хэш «#» не считается якорем", () => {
    expect(shouldShowCurtain({ ...first, hash: "#" })).toBe(true);
  });

  it("уже показывали в этой сессии — шторки нет", () => {
    expect(shouldShowCurtain({ ...first, sessionFlag: true })).toBe(false);
  });

  it("перезагрузка вкладки и возврат «назад» — шторки нет", () => {
    expect(shouldShowCurtain({ ...first, navigationType: "reload" })).toBe(false);
    expect(shouldShowCurtain({ ...first, navigationType: "back_forward" })).toBe(false);
  });

  it("неизвестный тип навигации не мешает показу", () => {
    expect(shouldShowCurtain({ ...first, navigationType: undefined })).toBe(true);
  });
});

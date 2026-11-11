import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FeatureBoundary } from "../src/components/FeatureBoundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps the page usable when an optional feature throws", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const recover = vi.fn();
  function Broken(): never { throw new Error("chunk unavailable"); }
  render(<><a href="tel:+79033581161">Позвонить</a><FeatureBoundary onError={recover} fallback={<p>Нет соединения</p>}><Broken /></FeatureBoundary></>);
  expect(screen.getByRole("link", { name: "Позвонить" })).toBeTruthy();
  expect(screen.getByText("Нет соединения")).toBeTruthy();
  expect(recover).toHaveBeenCalledTimes(1);
});

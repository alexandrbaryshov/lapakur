import { afterEach, expect, it, vi } from "vitest";
import { readLayout } from "../src/components/InkLine.thread";

afterEach(() => vi.restoreAllMocks());

it("ignores nonzero boxes of photos in closed albums, then includes them when opened", () => {
  const page = document.createElement("div");
  page.innerHTML = '<header><a href="#top">Logo</a></header><section id="top"><h1>Title</h1><figure></figure></section><section id="works"><details><summary>Album</summary><figure></figure></details><button data-cover-invite>Cover</button></section><section id="contacts"><a href="tel:123">Phone</a></section>';
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 100, 200, 300));
  const range = document.createRange();
  range.getBoundingClientRect = () => new DOMRect(20, 100, 100, 30);
  vi.spyOn(document, "createRange").mockReturnValue(range);
  expect(readLayout(page)?.works).toHaveLength(1);
  page.querySelector("details")!.open = true;
  expect(readLayout(page)?.works).toHaveLength(2);
  page.querySelector("details")!.open = false;
  expect(readLayout(page)?.works).toHaveLength(1);
});

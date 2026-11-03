import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MotionProvider } from "../src/components/MotionProvider";
import { CallButton } from "../src/components/CallButton";

afterEach(cleanup);

describe("Выбор способа записи", () => {
  it("открывает оба варианта и закрывается по Escape или нажатию вне списка", () => {
    render(<MotionProvider><CallButton variant="hero" /></MotionProvider>);
    const button = screen.getByRole("button", { name: /Записаться/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    const menu = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(within(menu).getByRole("link", { name: "Записаться по телефону" }).getAttribute("href")).toBe("tel:+79033581161");
    expect(within(menu).getByRole("link", { name: "Записаться онлайн" }).getAttribute("href")).toBe("https://dikidi.ru/1933719");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

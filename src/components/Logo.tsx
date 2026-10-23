import { STUDIO } from "../data/studio";
import styles from "./Logo.module.css";

// Логотип — вектор, перерисованный 1 в 1 (таск 02): однолинейный пудель и «Лапакюр».
// Рисуется самим файлом media/logo.svg (конвейер копирует его из media-src/logo/logo.svg)
// через CSS-маску: остаётся вектором, красится в currentColor, кэшируется браузером
// и не дублирует 25 КБ контура в HTML и в JS.

export type LogoProps = {
  /** full — пудель и надпись; mark — только пудель над линией земли (мелкие места). */
  variant?: "full" | "mark";
  /** Доступное имя; по умолчанию — название студии. Пустая строка — декоративный логотип. */
  title?: string;
  className?: string;
};

export function Logo({ variant = "full", title = STUDIO.name, className }: LogoProps) {
  const decorative = title === "";
  return (
    <span
      className={[styles.logo, variant === "mark" ? styles.mark : "", className].filter(Boolean).join(" ")}
      data-logo={variant}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
    />
  );
}

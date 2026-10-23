import { CallButton } from "../components/CallButton";
import { Logo } from "../components/Logo";
import { STUDIO } from "../data/studio";
import styles from "./Header.module.css";

// Шапка обложки по макету: слева логотип, по центру разделы разреженными капителями,
// справа «Записаться» с собакой у телефона и номер. Якоря — из interfaces.md («Секции»).

export const MENU = [
  { href: "#price", label: "Прайс" },
  { href: "#works", label: "Работы" },
  { href: "#faq", label: "Вопросы" },
  { href: "#contacts", label: "Контакты" },
] as const;

export function Header() {
  return (
    <header className={styles.header}>
      <a href="#top" className={styles.logo} aria-label={`${STUDIO.name} — к началу страницы`}>
        <Logo title="" className={styles.logoSvg} />
      </a>
      <nav aria-label="Разделы страницы" className={styles.nav}>
        <ul className={styles.menu}>
          {MENU.map((item) => (
            <li key={item.href} className={styles.item}>
              <a href={item.href} className={styles.link}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <CallButton variant="hero" showNumber className={styles.call} />
    </header>
  );
}

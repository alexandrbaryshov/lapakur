import { Logo } from "../components/Logo";
import { STUDIO } from "../data/studio";
import styles from "./Footer.module.css";

// Подвал: логотип, телефон, адрес, часы — тихая подпись страницы на фарфоре.
// data-site-footer — по нему липкая кнопка-звонок прячется у подвала.

export function Footer() {
  return (
    <footer className={styles.footer} data-site-footer>
      <a href="#top" className={styles.logo} aria-label={`${STUDIO.name} — к началу страницы`}>
        <Logo title="" className={styles.logoMark} />
      </a>
      <address className={styles.contacts}>
        <a href={STUDIO.phoneHref} className={styles.phone}>
          {STUDIO.phoneDisplay}
        </a>
        <a href={STUDIO.yandexOrgUrl} className={styles.address} target="_blank" rel="noopener noreferrer">
          {STUDIO.address}
        </a>
        <span className={styles.hours}>{STUDIO.hours}</span>
      </address>
    </footer>
  );
}

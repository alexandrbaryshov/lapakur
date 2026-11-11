import styles from './SocialLinks.module.css';

export function SocialLinks() {
  return <div className={styles.links} aria-label="Социальные сети">
    <a className={styles.link} href="https://vk.ru/lapakuir" target="_blank" rel="noopener noreferrer" aria-label="Лапакюр ВКонтакте">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 20c2 13 8 23 20 24v-8c4 0 7 3 10 8h10c-2-5-6-9-10-11 4-3 7-7 9-13h-9c-2 5-5 9-10 11V20h-8v15c-5-2-7-8-9-15z" /></svg><span>ВКонтакте</span>
    </a>
    <span className={`${styles.link} ${styles.pending}`} hidden aria-label="Instagram — ссылка появится позже">
      <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="13" y="13" width="38" height="38" rx="11"/><circle cx="32" cy="32" r="9"/><circle cx="43" cy="21" r="1.5"/></svg><span>Instagram</span>
    </span>
  </div>;
}

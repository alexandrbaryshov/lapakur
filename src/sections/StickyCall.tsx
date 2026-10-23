import { useEffect, useState } from "react";
import { CallButton } from "../components/CallButton";
import styles from "./StickyCall.module.css";

// Липкая кнопка-звонок на телефоне (spec.md, история 16): появляется, когда обложка ушла
// вверх, и прячется, когда виден подвал, — не перекрывает его. На ширине ≥ 768 px её нет
// (CSS). В пререндере она есть, но скрыта и недоступна. Стоит вне .page: у контейнера
// страницы своя сдерживающая раскладка, и position: fixed внутри неё не держался бы экрана.

export function StickyCall() {
  const [pastCover, setPastCover] = useState(false);
  const [footerInView, setFooterInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const cover = document.getElementById("top");
    const footer = document.querySelector("[data-site-footer]");
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === cover) setPastCover(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        else if (entry.target === footer) setFooterInView(entry.isIntersecting);
      }
    });
    if (cover) io.observe(cover);
    if (footer) io.observe(footer);
    return () => io.disconnect();
  }, []);

  const visible = pastCover && !footerInView;
  return (
    <div
      className={styles.sticky}
      data-sticky-call
      data-visible={visible || undefined}
      aria-hidden={visible ? undefined : true}
      inert={!visible || undefined}
    >
      <CallButton variant="compact" showNumber className={styles.button} />
    </div>
  );
}

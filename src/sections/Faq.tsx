import { m, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState } from "react";
import { ZOOM_SPRING } from "../components/zoom";
import { FAQ, type FaqItem } from "../data/faq";
import styles from "./Faq.module.css";

// Вопросы — тихий типографский экран (spec.md, история 22): вопросы дидоном на волосяных
// линейках, ответы раскрываются по одному. Кнопки — настоящие <button> с aria-expanded,
// поэтому работают с клавиатуры. Закрытый ответ остаётся в разметке (пререндер, поиск),
// но скрыт и inert — его не видно и не достать фокусом; без JS index.html раскрывает все.

const questionMotion: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.03 },
  tap: { scale: 1.03 },
};

type QuestionProps = { item: FaqItem; open: boolean; hydrated: boolean; onToggle: () => void };

function Question({ item, open, hydrated, onToggle }: QuestionProps) {
  const reduceMotion = useReducedMotion();
  const gestures = reduceMotion ? {} : { initial: "rest", animate: "rest", whileHover: "hover", whileTap: "tap" };
  const answerId = `faq-answer-${item.id}`;
  return (
    <li className={styles.item} data-open={open || undefined}>
      <h3 className={styles.heading}>
        <m.button
          type="button"
          id={`faq-question-${item.id}`}
          className={styles.question}
          aria-expanded={open}
          aria-controls={answerId}
          onClick={onToggle}
          {...gestures}
        >
          <m.span
            className={styles.questionText}
            variants={reduceMotion ? undefined : questionMotion}
            transition={ZOOM_SPRING}
          >
            {item.q}
          </m.span>
          <span className={styles.mark} aria-hidden="true" />
        </m.button>
      </h3>
      <div
        id={answerId}
        className={styles.answer}
        data-faq-answer
        inert={(hydrated && !open) || undefined}
      >
        <div className={styles.answerInner}>
          <p className={styles.answerText}>{item.a}</p>
        </div>
      </div>
    </li>
  );
}

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);
  // inert — только после гидрации: без JS ответы показывает <noscript> в index.html,
  // и они должны остаться доступными; пререндер и первый рендер клиента совпадают.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <section id="faq" aria-labelledby="faq-title" className={styles.section}>
      <div className={styles.inner}>
        <h2 id="faq-title" className={styles.title}>
          Вопросы
        </h2>
        <ul className={styles.list}>
          {FAQ.map((item) => (
            <Question
              key={item.id}
              item={item}
              open={openId === item.id}
              hydrated={hydrated}
              onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

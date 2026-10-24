import { m } from "motion/react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Picture } from "../components/Picture";
import { PriceChapters } from "../components/PriceChapters";
import { PriceTable } from "../components/PriceTable";
import { useZoom } from "../components/zoom";
import { PRICE_CHAPTERS, PRICE_GROUPS, type PriceChapterId, type PriceGroup, type PriceGroupId } from "../data/prices";
import { SERVICES, type ServiceId } from "../data/services";
import styles from "./Prices.module.css";

// Прайс — ведомость ателье на тёплой бумаге, на одной странице (spec.md, истории 17–19, 38–39).
// Сверху — начало, которое видно уже на первом экране макета: «ПРАЙС» и четыре главы пород
// (PriceChapters). Под главами — фото процедур в тех же колонках и три карточки листов; нажатие
// открывает окно листа с полной ведомостью (PriceSheetDialog — ленивый чанк, как просмотр фото).
//
// Без JS: карточки — ссылки на листы, а сами листы стоят в разметке под карточками и видны.
// С JS: встроенный скрипт в <head> ещё при разборе пререндера ставит <html data-sheets> — листы в странице
// скрыты с первой отрисовки (без скачка вёрстки), а после гидрации карточки становятся кнопками окна.
// Если скрипт страницы так и не пришёл, ссылка карточки показывает свой лист через :target.
// Все 31 строка остаются в разметке (поиск, диктор через окно, тесты). Всё — из src/data/.

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const service = (id: ServiceId) => SERVICES.find((s) => s.id === id)?.title ?? "";
/** «Гигиеническая стрижка» — подпись колонки листа без маркера сноски. */
const hygiene = (PRICE_GROUPS.find((g) => g.id === "complex-a")?.columns[2] ?? "").replace(/\*$/, "");

/** Что показывает фото процедуры каждой главы: подпись из услуг/прайса и описание кадра. */
const PROCEDURES: Record<PriceChapterId, { caption: string; alt: string }> = {
  bichon: {
    caption: service("grooming"),
    alt: "Белый бишон на столе в розовой студии: мастер подравнивает шерсть ножницами",
  },
  yorkie: {
    caption: hygiene,
    alt: "Йоркширский терьер на столе: мастер делает гигиеническую стрижку",
  },
  spitz: {
    caption: service("deshedding"),
    alt: "Рыжий шпиц на столе: мастер вычёсывает подшёрсток щёткой",
  },
  poodle: {
    caption: service("bath"),
    alt: "Рыжий пудель в ванне: мастер моет его из лейки",
  },
};

/** Колонка главы на компьютере — 506 из 2400 px макета; на телефоне — пол-экрана (не шире 800w при DPR 3). */
const PHOTO_SIZES = "(min-width: 900px) 21vw, 44vw";

function ProcedurePhoto({ chapterId }: { chapterId: PriceChapterId }) {
  const zoom = useZoom(1.03);
  const chapter = PRICE_CHAPTERS.find((c) => c.id === chapterId)!;
  const procedure = PROCEDURES[chapterId];
  return (
    <figure className={styles.photo} data-chapter={chapterId}>
      <m.div className={styles.plate} {...zoom}>
        <Picture media={chapter.photo} sizes={PHOTO_SIZES} alt={procedure.alt} imgClassName={styles.plateImg} />
      </m.div>
      <figcaption className={styles.photoCaption}>
        {chapter.title} · {lower(procedure.caption)}
      </figcaption>
    </figure>
  );
}

// ── карточки листов ──

/** Что в листе — коротко, по строкам листа (порядок и породы — как в прайсе). */
const CONTENTS: Record<PriceGroupId, string> = {
  "complex-a": "Ши-тцу, пекинес, бишон, мальтезе, спаниели, чихуа-хуа",
  "complex-b": "Йорки, шпицы, пудели — по весу и росту",
  "express-shedding": "Бигль, корги, мопс, лабрадор, хаски и крупные породы",
};

const sheetId = (id: PriceGroupId) => `price-sheet-${id}`;

/** «8 пород», «3 породы», «21 порода». */
function breedsLabel(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  const word = tens >= 11 && tens <= 14 ? "пород" : ones === 1 ? "порода" : ones >= 2 && ones <= 4 ? "породы" : "пород";
  return `${n} ${word}`;
}

/** Число пород листа (строки одной породы по весу и росту — одна порода) и позиций, если их больше. */
function countLabel(group: PriceGroup): string {
  const breeds = new Set(group.rows.map((row) => row.breed.split(" ")[0].toLowerCase())).size;
  const rows = group.rows.length;
  return breeds === rows ? breedsLabel(breeds) : `${breedsLabel(breeds)} · ${rows} позиций`;
}

/** Название листа на карточке: часть заголовка до двоеточия (состав — отдельной строкой). */
const cardTitle = (group: PriceGroup) => group.title.split(":")[0];

type SheetCardProps = {
  group: PriceGroup;
  /** После гидрации карточка — кнопка окна; до неё (и без JS) — ссылка на лист под карточками. */
  enhanced: boolean;
  onOpen: (group: PriceGroup, el: HTMLButtonElement) => void;
  onIntent: () => void;
};

function SheetCard({ group, enhanced, onOpen, onIntent }: SheetCardProps) {
  const zoom = useZoom(1.03);
  const body = (
    <>
      <span className={styles.cardTitle}>{cardTitle(group)}</span>
      <span className={styles.cardContents}>{CONTENTS[group.id]}</span>
      <span className={styles.cardFoot}>
        <span className={styles.cardCount}>{countLabel(group)}</span>
        <span className={styles.cardOpen}>
          Открыть лист
          <span className={styles.arrow} aria-hidden="true" />
        </span>
      </span>
    </>
  );
  return (
    <li className={styles.cardItem} data-sheet-card={group.id}>
      {enhanced ? (
        <m.button
          type="button"
          className={styles.card}
          aria-haspopup="dialog"
          onClick={(event) => onOpen(group, event.currentTarget)}
          onPointerEnter={onIntent}
          onFocus={onIntent}
          {...zoom}
        >
          {body}
        </m.button>
      ) : (
        <m.a href={`#${sheetId(group.id)}`} className={styles.card} {...zoom}>
          {body}
        </m.a>
      )}
    </li>
  );
}

// ── листы в странице (без JS — видны под карточками; с JS — источник окна и разметка для поиска) ──

function PriceSheet({ group }: { group: PriceGroup }) {
  const titleId = `${sheetId(group.id)}-title`;
  return (
    <section id={sheetId(group.id)} className={styles.sheet} aria-labelledby={titleId} data-sheet={group.id}>
      <header className={styles.sheetHead}>
        <h3 id={titleId} className={styles.sheetTitle}>
          {group.title}
        </h3>
        {group.footnotes.map((note) => (
          <p key={note} className={styles.footnote}>
            {note}
          </p>
        ))}
      </header>
      <PriceTable group={group} labelledBy={titleId} />
    </section>
  );
}

/** Ставится в <head> до первой отрисовки (HEAD_SCRIPT в App.tsx): JS есть — листы в странице прячутся. */
export const SHEETS_FLAG_SCRIPT = 'document.documentElement.setAttribute("data-sheets","")';

const loadDialog = () => import("../components/PriceSheetDialog");
const PriceSheetDialog = lazy(() => loadDialog().then((module) => ({ default: module.PriceSheetDialog })));

export function Prices() {
  const [enhanced, setEnhanced] = useState(false);
  const [active, setActive] = useState<PriceGroup | null>(null);
  const [requested, setRequested] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // гидрация прошла — карточки становятся кнопками окна (первый рендер совпадает с пререндером)
  useEffect(() => {
    setEnhanced(true);
    document.documentElement.setAttribute("data-sheets", "");
  }, []);

  const warm = useCallback(() => {
    loadDialog().catch(() => {});
  }, []);

  const open = useCallback((group: PriceGroup, el: HTMLButtonElement) => {
    trigger.current = el;
    setRequested(true);
    setActive(group);
  }, []);

  const close = useCallback(() => {
    setActive(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section id="price" aria-labelledby="price-title" className={styles.section}>
      <PriceChapters headingId="price-title" />
      <div className={styles.ledger}>
        <div className={styles.photos}>
          {PRICE_CHAPTERS.map((chapter) => (
            <ProcedurePhoto key={chapter.id} chapterId={chapter.id} />
          ))}
        </div>
        <ul className={styles.cards} aria-label="Листы прайса">
          {PRICE_GROUPS.map((group) => (
            <SheetCard key={group.id} group={group} enhanced={enhanced} onOpen={open} onIntent={warm} />
          ))}
        </ul>
        <div className={styles.sheets}>
          {PRICE_GROUPS.map((group) => (
            <PriceSheet key={group.id} group={group} />
          ))}
        </div>
      </div>
      {requested && (
        <Suspense fallback={null}>
          <PriceSheetDialog group={active} onClose={close} />
        </Suspense>
      )}
    </section>
  );
}

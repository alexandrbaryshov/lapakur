import { m } from "motion/react";
import { useEffect, useState } from "react";
import { COVER_BLOCKS, COVER_H, COVER_W, GUIDE, MASTHEAD, guidePath } from "../components/cover/layout";
import { useZoom } from "../components/zoom";
import { COVER_CITY, COVER_LINES, COVER_SAMPLE_SENSATION } from "../data/cover";
import { pickSensation } from "../data/sensations";
import { STUDIO } from "../data/studio";
import styles from "./CoverInvite.module.css";

// Рамка-приглашение в «Наших довольных питомцах»: выкройка обложки журнала «Лапакюр» — шапка,
// строки обложки и пунктир намётки силуэтом пуделя там, где встанет питомец, — и призыв сфотографировать питомца.
// Нажатие открывает камеру (CoverStudio). Разметка пререндерится с сенсацией-примером, а в браузере
// сенсация сменяется случайной из списка (после гидрации, чтобы разметки сервера и клиента совпали).

const GUIDE_PATH = guidePath();
const upper = (s: string) => s.toLocaleUpperCase("ru");
const { services, address } = COVER_BLOCKS;

export function CoverInvite({ onOpen }: { onOpen: (el: HTMLButtonElement) => void }) {
  const zoom = useZoom(1.015);
  const [sensation, setSensation] = useState(COVER_SAMPLE_SENSATION);
  useEffect(() => setSensation(pickSensation(COVER_SAMPLE_SENSATION)), []);
  return (
    <m.button
      type="button"
      className={styles.invite}
      data-cover-invite
      aria-haspopup="dialog"
      onClick={(event) => onOpen(event.currentTarget)}
      {...zoom}
    >
      <span className={styles.cover}>
        <svg className={styles.pattern} viewBox={`0 0 ${COVER_W} ${COVER_H}`} aria-hidden="true">
          <path className={styles.window} d={GUIDE_PATH} />
          <text className={styles.mast} x={MASTHEAD.left} y={MASTHEAD.baseline} fontSize={MASTHEAD.size} textLength={MASTHEAD.right - MASTHEAD.left} lengthAdjust="spacingAndGlyphs">
            {upper(STUDIO.name)}
          </text>
          <text className={styles.caps} x={COVER_W - 44} y={MASTHEAD.baseline + 46} textAnchor="end">
            {upper(`${COVER_CITY} · новый номер`)}
          </text>
          {COVER_LINES.services.head.map((line, i) => (
            <text key={line} className={styles.line} x={services.x} y={services.top + 44 + i * 52}>
              {upper(line)}
            </text>
          ))}
          {COVER_LINES.address.head.map((line, i) => (
            <text key={line} className={styles.line} x={address.x} y={address.top + 44 + i * 52} textAnchor="end">
              {upper(line)}
            </text>
          ))}
          <text className={styles.star} x={COVER_BLOCKS.star.x} y={1196}>
            ВАШ ПИТОМЕЦ
          </text>
          <text className={styles.caps} x={COVER_BLOCKS.star.x} y={1262}>
            {upper(sensation)}
          </text>
          {/* фотоаппарат линиями — в окне головы */}
          <g className={styles.camera} transform={`translate(${GUIDE.head.x} ${GUIDE.head.y})`}>
            <path d="M-78 -38H-34L-22 -58H22L34 -38H78V52H-78Z" />
            <circle r="30" cy="6" />
          </g>
          <path className={styles.basting} d={GUIDE_PATH} />
        </svg>
      </span>
      <span className={styles.copy}>
        <span className={styles.kicker}>Новый номер</span>
        <span className={styles.heading}>Ваш питомец&nbsp;— на обложке</span>
        <span className={styles.lead}>
          Сфотографируйте питомца&nbsp;— соберём обложку журнала «{STUDIO.name}» с&nbsp;его именем и сенсацией номера. Фото
          остаётся у&nbsp;вас в&nbsp;телефоне.
        </span>
        <span className={styles.cta}>Сфотографировать питомца</span>
      </span>
    </m.button>
  );
}

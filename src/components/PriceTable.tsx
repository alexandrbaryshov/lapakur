import { formatPrice, type PriceGroup } from "../data/prices";
import styles from "./PriceTable.module.css";

// Ведомость одного листа прайса (DESIGN.md, «Ведомость прайса»): шапка колонок мягкими чернилами
// над чернильной линейкой, строки между латунными волосками, цены вправо табличными цифрами.
// Одна разметка на два места: лист в странице (без JS он виден под карточками) и окно листа
// (PriceSheetDialog). Строки, время, «от» и почасовая ставка — только из PRICE_GROUPS.

/** Подпись почасовой ставки дословно с листа: «1400 — 1 час работы». */
export const hourlyLabel = (amount: number) => `${formatPrice({ amount })} — 1 час работы`;

export type PriceTableProps = {
  group: PriceGroup;
  /** id заголовка листа, которым подписана таблица. */
  labelledBy: string;
  className?: string;
};

export function PriceTable({ group, labelledBy, className }: PriceTableProps) {
  const express = group.durationLabel !== undefined;
  return (
    <table
      className={[styles.table, className].filter(Boolean).join(" ")}
      aria-labelledby={labelledBy}
      data-kind={express ? "express" : "complex"}
    >
      <thead>
        <tr>
          <th scope="col" className={styles.breedHead}>
            Порода
          </th>
          {express && (
            <th scope="col" className={styles.timeHead}>
              {group.durationLabel}
            </th>
          )}
          {group.columns.map((column) => (
            <th key={column} scope="col" className={styles.priceHead}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {group.rows.map((row) => (
          <tr key={row.breed} className={styles.row}>
            <th scope="row" className={styles.breed}>
              {row.breed}
            </th>
            {express && (
              <td className={styles.time} data-label={group.durationLabel} data-empty={row.duration ? undefined : true}>
                {row.duration ?? "—"}
              </td>
            )}
            {row.cells.map((cell, k) => (
              <td
                key={group.columns[k]}
                className={styles.price}
                data-price
                data-label={group.columns[k]}
                data-empty={cell === null ? true : undefined}
              >
                <span className={styles.amount}>{formatPrice(cell)}</span>
                {row.hourly !== undefined && <span className={styles.hourly}>{hourlyLabel(row.hourly)}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Пять услуг из брифа (product.md, п. 2). Цен здесь нет: у окраски и подстрижки
// когтей их нет и в прайсе, остальные цены — в prices.ts.

export type ServiceId = "grooming" | "nails" | "bath" | "coloring" | "deshedding";

export type Service = { id: ServiceId; title: string };

export const SERVICES: readonly Service[] = [
  { id: "grooming", title: "Стрижка (груминг)" },
  { id: "nails", title: "Подстрижка когтей" },
  { id: "bath", title: "Мытьё" },
  { id: "coloring", title: "Окраска" },
  { id: "deshedding", title: "Вычёсывание" },
];

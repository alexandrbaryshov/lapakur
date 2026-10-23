// Геометрия сквозной линии «Ателье одной линии» — чистые функции, без DOM.
// Линия выходит из линии земли логотипа, обвивает обложку и прошивает страницу до телефона в визите.
// На компьютере (≥ 900 px) первый экран — контур утверждённого макета (HERO_INK_PATH): он уходит
// за правый край у верха страницы, как в макете, и нить возвращается из-за края под первым экраном
// (за краем она не видна — как намётка, ушедшая под ткань). На телефоне линия своя: петля в шапке,
// через точку меню, за шапкой и обложкой, петля слева от обложки и под ней — и дальше по полям.
// Путь проходит только по пустым полям и промежуткам между блоками: текст и цели нажатия он не пересекает
// (за шапкой ЛАПАКЮР и пластиной обложки нить уходит под них, как в макете).

/** Контур первого экрана, координаты макета 2400 × 1792 (скелет штриха снят с макета). */
export const HERO_INK_PATH =
  "M298 182C300 181 302 180 305 179C316 177 336 180 351 181C366 182 373 182 396 187C419 193 469 208 491 214" +
  "C513 220 518 220 528 222C538 223 542 224 552 224C562 224 581 224 591 224C601 224 604 223 612 222" +
  "C620 220 630 218 638 215C646 212 655 209 662 206C669 202 676 198 682 193C688 188 693 183 697 178" +
  "C701 173 704 168 706 162C707 156 707 148 707 143C706 138 705 134 702 130C699 126 695 121 691 118" +
  "C687 115 682 113 677 112C672 111 665 111 660 112C655 113 651 114 647 117C643 120 638 125 635 129" +
  "C631 133 629 137 627 142C625 147 623 155 621 161C620 167 619 169 619 177C619 185 619 199 620 207" +
  "C620 215 621 217 622 224C624 231 625 239 629 251C633 263 640 282 646 296C652 310 653 312 664 332" +
  "C674 352 699 395 710 417C722 439 728 453 732 462C736 471 730 459 735 472C740 485 749 512 760 540" +
  "C771 568 790 607 800 640C810 673 822 711 820 740C818 769 801 797 790 815C779 833 762 841 755 848" +
  "C748 855 752 853 749 856C746 859 745 861 738 866C731 872 717 882 707 888C697 894 694 896 677 903" +
  "C660 910 622 924 604 932C586 940 577 946 569 950C561 955 559 957 554 961C549 965 543 970 538 975" +
  "C534 980 530 984 527 989C523 994 520 999 516 1006C513 1013 510 1022 508 1031C507 1040 507 1050 507 1057" +
  "C507 1064 508 1069 510 1076C512 1083 515 1091 517 1097C520 1103 523 1107 527 1112C531 1117 534 1122 540 1126" +
  "C546 1131 557 1137 564 1140C571 1143 574 1144 580 1144C586 1145 596 1145 603 1144C610 1144 616 1142 622 1139" +
  "C628 1136 634 1133 639 1129C644 1125 650 1120 655 1114C659 1108 665 1099 668 1092C672 1085 674 1078 675 1073" +
  "C677 1068 677 1067 677 1060C677 1053 677 1040 676 1032C674 1024 671 1018 668 1013C664 1008 660 1004 655 1000" +
  "C650 997 644 994 638 993C632 992 626 992 620 992C614 993 608 995 602 998C596 1001 590 1006 584 1011" +
  "C578 1017 572 1024 568 1031C563 1038 558 1047 555 1054C551 1061 550 1064 548 1071C545 1078 542 1088 540 1096" +
  "C538 1104 537 1111 536 1119C536 1127 536 1136 536 1145C536 1154 538 1162 539 1171C541 1180 543 1190 547 1200" +
  "C550 1210 556 1224 560 1232C564 1240 565 1243 570 1251C575 1259 583 1271 590 1281C598 1291 605 1300 615 1311" +
  "C625 1322 640 1337 652 1347C664 1358 675 1366 685 1373C695 1380 703 1385 713 1391C723 1396 736 1403 747 1407" +
  "C758 1411 766 1414 776 1417C786 1420 797 1423 810 1424C823 1426 842 1426 853 1426C864 1426 868 1425 877 1424" +
  "C886 1422 897 1419 906 1416C915 1414 922 1411 931 1406C940 1402 951 1395 959 1390C967 1384 970 1382 977 1375" +
  "C984 1369 994 1360 1002 1351C1010 1342 1021 1328 1026 1322C1031 1316 1026 1322 1032 1317" +
  "C1038 1312 1047 1300 1060 1295C1073 1290 1093 1284 1110 1285C1127 1286 1148 1295 1160 1300" +
  "C1172 1305 1168 1308 1185 1317C1202 1326 1238 1345 1259 1355C1280 1364 1296 1370 1309 1374" +
  "C1322 1379 1329 1381 1340 1384C1351 1387 1360 1390 1373 1393C1386 1396 1404 1400 1419 1402" +
  "C1434 1405 1450 1408 1464 1409C1478 1411 1486 1412 1505 1413C1524 1414 1560 1413 1576 1413" +
  "C1592 1413 1593 1412 1603 1410C1613 1409 1628 1406 1638 1404C1648 1402 1653 1400 1662 1397" +
  "C1671 1395 1682 1391 1691 1387C1700 1383 1709 1378 1718 1373C1727 1368 1736 1362 1744 1356" +
  "C1752 1350 1758 1344 1764 1338C1770 1333 1775 1328 1780 1322C1784 1316 1788 1311 1792 1305" +
  "C1796 1299 1800 1294 1803 1287C1807 1280 1810 1273 1813 1266C1816 1259 1818 1250 1820 1243" +
  "C1822 1236 1822 1229 1823 1222C1824 1215 1823 1206 1823 1200C1823 1194 1822 1192 1821 1186" +
  "C1820 1180 1817 1172 1814 1167C1812 1162 1809 1158 1806 1154C1802 1150 1799 1147 1795 1145" +
  "C1791 1143 1786 1141 1782 1140C1778 1139 1774 1139 1769 1140C1764 1140 1758 1142 1754 1144" +
  "C1750 1147 1746 1151 1744 1154C1741 1157 1740 1159 1739 1162C1738 1165 1737 1169 1736 1172" +
  "C1736 1175 1736 1179 1736 1182C1737 1185 1737 1189 1739 1192C1740 1195 1743 1199 1745 1202" +
  "C1748 1205 1749 1207 1753 1209C1757 1212 1764 1216 1770 1217C1776 1219 1778 1219 1786 1219" +
  "C1794 1218 1806 1217 1818 1214C1830 1211 1843 1206 1855 1201C1867 1196 1882 1188 1892 1182" +
  "C1902 1176 1909 1171 1918 1164C1927 1157 1938 1147 1947 1139C1956 1131 1963 1122 1970 1114" +
  "C1978 1106 1983 1099 1989 1090C1996 1081 2003 1070 2009 1059C2015 1048 2020 1038 2025 1027" +
  "C2030 1016 2034 1003 2037 994C2039 985 2040 981 2042 973C2043 965 2044 957 2045 948C2046 939 2046 930 2045 920" +
  "C2044 910 2042 898 2039 890C2037 882 2035 879 2032 873C2029 867 2025 860 2020 855C2016 850 2013 847 2008 843" +
  "C2003 839 1997 836 1991 833C1985 830 1978 828 1972 827C1966 826 1963 825 1957 825C1951 825 1942 825 1934 826" +
  "C1926 827 1914 829 1906 832C1898 834 1893 836 1885 839C1877 843 1867 848 1860 852C1853 856 1849 860 1844 864" +
  "C1839 869 1835 873 1832 879C1828 885 1824 893 1823 898C1821 903 1821 904 1820 907C1820 910 1819 913 1820 918" +
  "C1822 923 1824 933 1828 939C1831 945 1837 951 1842 956C1847 961 1852 965 1859 969C1866 973 1874 977 1884 981" +
  "C1894 985 1907 989 1919 992C1931 995 1943 997 1955 998C1967 1000 1978 1001 1990 1001" +
  "C2002 1001 2018 1001 2029 1000C2040 999 2048 998 2058 996C2068 995 2082 992 2092 989" +
  "C2102 986 2111 984 2121 980C2131 976 2140 972 2152 966C2164 960 2179 951 2190 943C2201 936 2206 932 2217 922" +
  "C2228 912 2243 897 2254 884C2266 871 2276 856 2285 842C2294 828 2301 814 2309 797C2317 780 2326 758 2332 740" +
  "C2339 722 2343 709 2347 692C2351 675 2355 660 2359 639C2362 618 2366 598 2369 569C2373 540 2377 492 2380 468" +
  "C2382 444 2384 442 2387 428C2390 414 2397 390 2399 382";

/** Ширина макета: 1 px макета = ширина страницы / COMP_WIDTH. */
export const COMP_WIDTH = 2400;
/** Высота первого экрана макета. */
export const COMP_HEIGHT = 1792;
/** Начало контура — конец линии земли под пуделем: доли ширины области логотипа (126, 24, 188 px макета). */
export const LOGO_GROUND = { x: (298 - 126) / 188, y: (182 - 24) / 188 };
/** Конец контура (за правым краем у верха) и касательная к нему — из последнего сегмента HERO_INK_PATH. */
const HERO_END = { x: 2399, y: 382 };
const HERO_END_DIR = { x: 2, y: -8 };
/** С этой ширины страница держит сетку макета. */
export const DESKTOP_MIN = 900;

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/** Раскладка страницы для линии — прямоугольники в координатах страницы (px). */
export type ThreadLayout = {
  width: number;
  /** Ссылка-логотип в шапке. */
  logo: Box;
  /** «Записаться» в шапке. */
  call?: Box;
  /** Пункты меню шапки (на телефоне нить проходит через точку между вторым и третьим). */
  navLinks: Box[];
  /** Шапка ЛАПАКЮР и пластина обложки: нить уходит под них. */
  masthead: Box;
  plate: Box;
  /** Подзаголовок и услуги — текст (по строкам, а не блок). */
  tagline?: Box;
  services?: Box;
  /** «Прайс», фото процедур (вместе), листы прайса, низ секции прайса. */
  priceHeading?: Box;
  pricePhotos?: Box;
  sheets: Box[];
  priceBottom?: number;
  /** Кадры «Наших довольных питомцев» с подписями и заголовок секции. */
  worksTitle?: Box;
  works: Box[];
  /** «Вопросы»: заголовок (текст) и список. */
  faqTitle?: Box;
  faqList?: Box;
  /** «Контакты»: заголовок (текст) и крупный телефон (текст) — здесь нить кончается. */
  contactsTitle?: Box;
  phone: Box;
};

export type Thread = {
  /** Весь путь одной линией: M… C… */
  d: string;
  /** Часть первого экрана (её рисует появление после шторки), начало того же пути. */
  heroD: string;
};

const right = (b: Box) => b.x + b.w;
const bottom = (b: Box) => b.y + b.h;
const midY = (b: Box) => b.y + b.h / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const f = (n: number) => String(Math.round(n * 100) / 100);
const pt = (x: number, y: number): Point => ({ x, y });

/** Равномерное масштабирование пути из абсолютных команд (M, C): все числа — координаты. */
export function scalePath(d: string, k: number): string {
  return d.replace(/-?\d+(?:\.\d+)?/g, (n) => f(Number(n) * k));
}

const unit = (v: Point) => {
  const len = Math.hypot(v.x, v.y) || 1;
  return pt(v.x / len, v.y / len);
};

/** Шаг вперёд, на который сдвигает нить петля `curl` высотой `size`. */
export const curlAdvance = (size: number, tightness = CURL_TIGHTNESS) => 2 * tightness * Math.PI * (size / 2);
const CURL_TIGHTNESS = 0.36;

/**
 * Рукописная петля «ℓ», как петли линии в макете: нить идёт по `dir`, поднимается в сторону `toward`,
 * обходит петлю и, пересёкши себя, выходит дальше по тому же направлению (удлинённая трохоида).
 * `size` — высота петли от линии хода; петля сдвигает нить вперёд на curlAdvance(size).
 */
export function curl(start: Point, dir: Point, size: number, toward: Point, tightness = CURL_TIGHTNESS, steps = 18): Point[] {
  const u = unit(dir);
  let n = pt(-u.y, u.x);
  if (n.x * toward.x + n.y * toward.y < 0) n = pt(u.y, -u.x);
  const k = size / 2;
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI + (2 * Math.PI * i) / steps;
    const along = (tightness * t - Math.sin(t) + tightness * Math.PI) * k;
    const across = (1 + Math.cos(t)) * k;
    out.push(pt(start.x + u.x * along + n.x * across, start.y + u.y * along + n.y * across));
  }
  return out;
}

/**
 * Гладкая кривая через точки (Катмулл — Ром → кубические Безье), без начального M:
 * продолжает текущий путь из points[0]. `startDir` задаёт касательную в первой точке.
 */
export function spline(points: Point[], startDir?: Point): string {
  const p = points.filter((q, i) => i === 0 || Math.hypot(q.x - points[i - 1].x, q.y - points[i - 1].y) > 0.5);
  const n = p.length;
  if (n < 2) return "";
  const at = (i: number) => (i < 0 ? pt(2 * p[0].x - p[1].x, 2 * p[0].y - p[1].y) : i >= n ? pt(2 * p[n - 1].x - p[n - 2].x, 2 * p[n - 1].y - p[n - 2].y) : p[i]);
  let d = "";
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = at(i + 2);
    // ручки не длиннее трети хорды: при неравном шаге точек кривая не выстреливает за них
    const reach = Math.hypot(p2.x - p1.x, p2.y - p1.y) / 3;
    const handle = (v: Point) => {
      const len = Math.hypot(v.x, v.y);
      return len > reach ? pt((v.x / len) * reach, (v.y / len) * reach) : v;
    };
    const t1 = i === 0 && startDir ? pt(unit(startDir).x * reach, unit(startDir).y * reach) : handle(pt((p2.x - p0.x) / 6, (p2.y - p0.y) / 6));
    const t2 = handle(pt((p3.x - p1.x) / 6, (p3.y - p1.y) / 6));
    const c1 = pt(p1.x + t1.x, p1.y + t1.y);
    const c2 = pt(p2.x - t2.x, p2.y - t2.y);
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/** Точка, где нить кончается: справа от последней цифры телефона, на середине строки. */
export function threadEnd(layout: ThreadLayout): Point {
  const k = layout.width >= DESKTOP_MIN ? layout.width / COMP_WIDTH : 0;
  return pt(right(layout.phone) + Math.max(12, 22 * k), layout.phone.y + layout.phone.h * 0.55);
}

/** Начало нити — конец линии земли логотипа. */
export function threadStart(layout: ThreadLayout): Point {
  const { logo } = layout;
  return pt(logo.x + LOGO_GROUND.x * logo.w, logo.y + LOGO_GROUND.y * logo.w);
}

/** Нить для страницы: компьютерная (контур макета + продолжение) или телефонная. */
export function buildThread(layout: ThreadLayout): Thread {
  return layout.width >= DESKTOP_MIN ? desktopThread(layout) : phoneThread(layout);
}

// ───────────────────────── компьютер ─────────────────────────

function desktopThread(l: ThreadLayout): Thread {
  const W = l.width;
  const s = W / COMP_WIDTH;
  const heroD = scalePath(HERO_INK_PATH, s);
  const end = pt(HERO_END.x * s, HERO_END.y * s);
  const edge = W - 50 * s; // край поля бумаги прайса (отступ 50 px макета)
  const left = 50 * s; // середина левого поля страницы (99 px макета)
  const down = pt(0, 1);
  const pts: Point[] = [end];

  // за правым краем: нить поднимается, уходит вниз под тканью и возвращается под первым экраном
  const enterY = Math.max(COMP_HEIGHT * s + 30 * s, (l.pricePhotos?.y ?? COMP_HEIGHT * s) - 10 * s);
  pts.push(pt(W + 26 * s, end.y - 50 * s), pt(W + 80 * s, end.y + 220 * s), pt(W + 80 * s, enterY - 320 * s));
  pts.push(pt(W + 14 * s, enterY - 70 * s), pt(edge + 16 * s, enterY));

  // прайс: по краю бумаги; в промежутках между фото и листами — петля внутрь поля
  const gapCurl = (top: number, below: number) => {
    const size = clamp((below - top) * 0.55, 16 * s, 90 * s);
    const adv = curlAdvance(size);
    const y0 = (top + below) / 2 - adv / 2;
    pts.push(pt(edge + 4 * s, y0 - 60 * s), ...curl(pt(edge, y0), down, size, pt(-1, 0)), pt(edge + 4 * s, y0 + adv + 60 * s));
  };
  if (l.pricePhotos) {
    pts.push(pt(edge - 10 * s, midY(l.pricePhotos)));
    if (l.sheets[0]) gapCurl(bottom(l.pricePhotos) + 40 * s, l.sheets[0].y);
  }
  l.sheets.forEach((sheet, i) => {
    pts.push(pt(edge + (i % 2 ? -12 : 12) * s, midY(sheet)));
    const next = l.sheets[i + 1];
    if (next && i % 2 === 1) gapCurl(bottom(sheet), next.y);
  });
  const ledgerEnd = l.sheets.length ? bottom(l.sheets[l.sheets.length - 1]) : (l.priceBottom ?? enterY);
  pts.push(pt(edge - 8 * s, ledgerEnd + 160 * s));

  // работы: правое поле страницы
  if (l.works.length) {
    const top = Math.min(...l.works.map((b) => b.y));
    const worksEnd = Math.max(...l.works.map(bottom));
    pts.push(pt(edge + 10 * s, top + 120 * s), pt(edge - 6 * s, (top + worksEnd) / 2), pt(edge + 6 * s, worksEnd));

    // промежуток до «Вопросов»: нить переходит на левое поле, по пути — петля
    const nextTop = l.faqTitle?.y ?? l.contactsTitle?.y ?? l.phone.y;
    const band = nextTop - worksEnd;
    const size = clamp(band * 0.4, 24 * s, 120 * s);
    const dir = pt(-1, 0.12);
    const c0 = pt(W * 0.56, worksEnd + band * 0.52);
    pts.push(pt(W * 0.76, worksEnd + band * 0.38), ...curl(c0, dir, size, pt(0, -1)));
    pts.push(pt(W * 0.3, worksEnd + band * 0.66), pt(left + 50 * s, nextTop - 50 * s), pt(left, nextTop + 30 * s));
  }

  // вопросы: левое поле; под заголовком (колонки 1–4 пусты) — большая петля
  if (l.faqTitle && l.faqList) {
    const top = bottom(l.faqTitle) + 40 * s;
    const low = bottom(l.faqList);
    const room = l.faqList.x - 60 * s - l.faqTitle.x;
    const size = clamp(Math.min(room * 0.5, (low - top) * 0.42), 30 * s, 260 * s);
    const dir = pt(1, 0.5);
    const c0 = pt(left + 40 * s, top + (low - top) * 0.3);
    pts.push(pt(left, top), ...curl(c0, dir, size, pt(0.4, -1)));
    pts.push(pt(left + 70 * s, low - (low - top) * 0.12), pt(left, low));
  }

  // контакты: левое поле, петля между заголовком и телефоном, конец — у телефона
  appendFinale(pts, l, left, s);
  return { d: `${heroD}${spline(pts, HERO_END_DIR)}`, heroD };
}

function appendFinale(pts: Point[], l: ThreadLayout, left: number, s: number) {
  const k = Math.max(s, 0.4);
  const end = threadEnd(l);
  const phone = l.phone;
  if (l.contactsTitle) {
    const t = l.contactsTitle;
    const band = phone.y - bottom(t);
    pts.push(pt(left, t.y - 30 * k), pt(left, bottom(t) + band * 0.2));
    const size = clamp(band * 0.34, 14, 60 * k);
    const c0 = pt(phone.x + phone.w * 0.38, bottom(t) + band * 0.5 + size * 0.35);
    pts.push(pt(phone.x + phone.w * 0.16, c0.y + 4 * k), ...curl(c0, pt(1, 0.08), size, pt(0, -1)));
  }
  pts.push(pt(end.x + 40 * k, phone.y - 6 * k), end);
}

// ───────────────────────── телефон ─────────────────────────

function phoneThread(l: ThreadLayout): Thread {
  const W = l.width;
  const g = clamp(l.logo.x, 8, 40); // поле страницы
  const gl = g / 2;
  const gr = W - g / 2;
  const down = pt(0, 1);
  const start = threadStart(l);
  const pts: Point[] = [start];

  // 1. от линии земли вправо, петля в пустом месте шапки между логотипом и «Записаться»
  const sizeA = clamp(l.logo.h * 0.42, 16, 34);
  pts.push(...curl(pt(Math.max(start.x + 12, right(l.logo) + 6), start.y + 2), pt(1, 0.12), sizeA, pt(0, -1)));

  // 2. через точку меню между вторым и третьим пунктами (между целями нажатия), за шапку и обложку
  const [, l2, l3] = l.navLinks;
  const nav = l.navLinks[0];
  if (l2 && l3 && nav) {
    const dot = pt((right(l2) + l3.x) / 2, midY(nav));
    pts.push(pt(dot.x - 6, nav.y - 9), dot, pt(dot.x, bottom(nav) + 10));
    pts.push(pt(dot.x - 4, l.masthead.y + l.masthead.h * 0.7));
  }
  const { plate } = l;
  pts.push(pt(plate.x + plate.w * 0.25, plate.y + plate.h * 0.35));

  // 3. из-под обложки влево — петля в полосе слева от неё, затем под обложкой на правое поле;
  //    когда пластина во всю колонку и полоса — одно поле страницы, петля мельче, у самого края и без наклона
  const roomy = clamp((plate.x - 24) / 24, 0, 1);
  const sizeB = clamp(plate.x * 0.62, 8, 46);
  const dirB = pt(-0.25 * roomy, 1);
  const startB = pt(plate.x - 2 - 4 * roomy, plate.y + plate.h * 0.5);
  const under = l.tagline ? (bottom(plate) + l.tagline.y) / 2 : bottom(plate) + 12;
  pts.push(pt(plate.x + 6, startB.y - 26), ...curl(startB, dirB, sizeB, pt(-1, 0)));
  pts.push(pt(plate.x - 12, bottom(plate) - 30), pt(plate.x + plate.w * 0.14, under), pt(right(plate) + 8, under));
  const afterHero = l.services ? bottom(l.services) : l.tagline ? bottom(l.tagline) : under + 60;
  pts.push(pt(gr - 3, under + 20), pt(gr, afterHero));
  const heroPoints = pts.length;

  // 4. прайс: петля справа от «Прайс», дальше — полоса фарфора справа от бумаги, петли между листами
  if (l.priceHeading) {
    const h = l.priceHeading;
    const size = clamp(h.h * 0.75, 16, 28);
    const y0 = midY(h) - curlAdvance(size) / 2;
    pts.push(pt(gr, y0 - 30), ...curl(pt(gr, y0), down, size, pt(-1, 0)), pt(gr, y0 + curlAdvance(size) + 30));
  }
  if (l.pricePhotos) pts.push(pt(gr + 1, midY(l.pricePhotos)));
  l.sheets.forEach((sheet, i) => {
    pts.push(pt(gr - 1, sheet.y + 20));
    const next = l.sheets[i + 1];
    if (next) {
      const size = 14;
      const y0 = (bottom(sheet) + next.y) / 2 - curlAdvance(size) / 2;
      pts.push(pt(gr, y0 - 30), ...curl(pt(gr, y0), down, size, pt(-1, 0)), pt(gr, y0 + curlAdvance(size) + 30));
    }
  });
  const ledgerEnd = l.sheets.length ? bottom(l.sheets[l.sheets.length - 1]) : (l.priceBottom ?? afterHero + 200);
  pts.push(pt(gr, ledgerEnd + 16));

  // 5. переход на левое поле перед «Нашими довольными питомцами», по пути — петля
  if (l.worksTitle) {
    const band = l.worksTitle.y - ledgerEnd;
    const size = clamp(band * 0.14, 14, 30);
    pts.push(pt(W * 0.8, ledgerEnd + band * 0.34), ...curl(pt(W * 0.62, ledgerEnd + band * 0.42), pt(-1, 0.16), size, pt(0, -1)));
    pts.push(pt(W * 0.3, ledgerEnd + band * 0.64), pt(gl + 14, l.worksTitle.y - 24), pt(gl, l.worksTitle.y + 26));
  }
  if (l.works.length) {
    const worksEnd = Math.max(...l.works.map(bottom));
    pts.push(pt(gl + 1, (Math.min(...l.works.map((b) => b.y)) + worksEnd) / 2), pt(gl, worksEnd + 8));
    if (l.faqTitle) {
      const band = l.faqTitle.y - worksEnd;
      const size = clamp(band * 0.16, 14, 32);
      const y0 = worksEnd + band * 0.5 - curlAdvance(size) / 2;
      pts.push(...curl(pt(gl, y0), pt(0.12, 1), size, pt(1, 0)), pt(gl, l.faqTitle.y + 4));
    }
  }
  if (l.faqList) pts.push(pt(gl + 1, midY(l.faqList)), pt(gl, bottom(l.faqList) + 14));

  // 6. к «Контактам»: петля справа от заголовка, конец — справа от номера телефона
  const end = threadEnd(l);
  if (l.contactsTitle) {
    const t = l.contactsTitle;
    const from = l.faqList ? bottom(l.faqList) + 14 : t.y - 80;
    // сверху над заголовком — мимо конца слова — и петля справа от него
    pts.push(pt(gl + 10, from + (t.y - from) * 0.3), pt(Math.min(W * 0.42, right(t) - 40), from + (t.y - from) * 0.55));
    pts.push(pt(right(t) + 6, t.y - 14));
    const size = clamp(t.h * 0.55, 14, 24);
    pts.push(...curl(pt(right(t) + 18, midY(t) + size * 0.3), pt(1, 0.12), size, pt(0, -1)));
  }
  pts.push(pt(Math.min(end.x + 34, W - g / 2), l.phone.y - 4), end);

  const heroD = `M${f(start.x)} ${f(start.y)}${spline(pts.slice(0, heroPoints))}`;
  return { d: `M${f(start.x)} ${f(start.y)}${spline(pts)}`, heroD };
}

// ───────────────────────── прорисовка по прокрутке ─────────────────────────

/**
 * Отсчёты пути по длине: накопленная длина и наибольшая высота (y) на пути до этой точки.
 * Нить дорисовывается до места, где путь впервые опускается ниже пера (penY).
 */
export type InkSamples = { lengths: Float64Array; maxY: Float64Array; total: number; heroLength: number };

/** Длина начала пути, целиком лежащего выше пера. */
export function lengthAbove(samples: InkSamples, penY: number): number {
  const { lengths, maxY } = samples;
  if (lengths.length === 0 || maxY[0] > penY) return 0;
  let lo = 0;
  let hi = maxY.length - 1;
  if (maxY[hi] <= penY) return samples.total;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (maxY[mid] <= penY) lo = mid;
    else hi = mid - 1;
  }
  return lengths[lo];
}

/**
 * Какая доля нити нарисована: при reduced-motion — вся; пока идёт появление после шторки
 * (entrance 0 → 1) — эта доля первого экрана; потом — первый экран и всё, что выше пера.
 */
export function drawnFraction(samples: InkSamples, penY: number, entrance: number, reduced = false): number {
  if (reduced || samples.total <= 0) return 1;
  const len = entrance < 1 ? entrance * samples.heroLength : Math.max(samples.heroLength, lengthAbove(samples, penY));
  return clamp(len / samples.total, 0, 1);
}

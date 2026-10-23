// Публичная копия без истории для GitHub: `node scripts/export-public.mjs [папка]` (по умолчанию ../lapakur-github).
// Копирует файлы последнего коммита, кроме рабочих материалов автопилота и impeccable (isPublic),
// и коммитит их в отдельный git-репозиторий в этой папке (ветка master, создаётся при первом запуске).
// Публикуется он: push в его master → GitHub Pages (.github/workflows/pages.yml).
// Удаляет в копии только файлы, которые туда положила прошлая выгрузка и которых больше нет в проекте.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Попадает ли файл проекта (путь от корня через «/») в публичную копию. */
export function isPublic(path) {
  // из .autopilot — только facts.md: tests/data.test.ts сверяет с ним цены и контакты
  if (path.startsWith(".autopilot/")) return /^\.autopilot\/[^/]+\/facts\.md$/.test(path);
  if (path.startsWith(".impeccable/") || path.startsWith("assets/")) return false;
  return path !== "AGENTS.md" && path !== "CLAUDE.md";
}

// stderr git (предупреждения про CRLF на каждый файл) не печатается — при ошибке он в тексте исключения
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tracked = (cwd) => git(cwd, "ls-files", "-z").split("\0").filter(Boolean);

export function exportPublic(target) {
  if (resolve(target) === resolve(ROOT)) throw new Error("Папка выгрузки — сам проект");
  if (git(ROOT, "status", "--porcelain", "--untracked-files=no").trim()) {
    throw new Error("В проекте незакоммиченные правки: выгружается последний коммит — сначала закоммить");
  }

  const files = tracked(ROOT).filter(isPublic);
  mkdirSync(target, { recursive: true });
  if (!existsSync(join(target, ".git"))) git(target, "init", "-b", "master");

  const keep = new Set(files);
  for (const old of tracked(target)) if (!keep.has(old)) rmSync(join(target, old), { force: true });
  for (const file of files) {
    mkdirSync(dirname(join(target, file)), { recursive: true });
    copyFileSync(join(ROOT, file), join(target, file));
  }

  git(target, "add", "-A");
  if (!git(target, "status", "--porcelain").trim()) {
    console.log(`Без изменений: ${target}`);
    return;
  }
  const sha = git(ROOT, "rev-parse", "--short", "HEAD").trim();
  git(target, "commit", "-q", "-m", `Сайт Лапакюра (исходный коммит ${sha})`);
  console.log(`Выгружено ${files.length} файлов в ${target}, коммит создан — осталось git push`);
}

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isCli) exportPublic(resolve(ROOT, process.argv[2] ?? "../lapakur-github"));

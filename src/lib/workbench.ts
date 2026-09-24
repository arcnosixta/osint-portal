import type { Tool } from "./tools";

/**
 * Workbench configuration — the "control deck" for every tool page.
 *
 * Each profile describes:
 *   - `runner`      — the executable name shown in the terminal line
 *   - `targetKind`  — what the target field means for this tool
 *   - `presets`     — one-click payloads (target + args) shown as quick cards
 *   - `chips`       — flag-palette buttons that toggle argv units in/out
 *   - `resultView`  — how the structured `data` payload is rendered
 *   - `wired`       — false until the segment is connected (see segments/)
 */

export type TargetKind = "network" | "hostname" | "username";

export type ResultView = "ports" | "records" | "found" | "whois" | "plain";

export interface Bilingual {
  en: string;
  ru: string;
}

export interface WorkbenchPreset {
  id: string;
  label: Bilingual;
  target: string;
  args: string[];
}

export interface WorkbenchChip {
  id: string;
  label: Bilingual;
  /** argv unit appended/removed as one block (flag, possibly + value). */
  args: string[];
}

export interface WorkbenchProfile {
  runner: string;
  targetKind: TargetKind;
  targetPlaceholder: Bilingual;
  presets: WorkbenchPreset[];
  chips: WorkbenchChip[];
  resultView: ResultView;
  wired: boolean;
}

const DEFAULT_PLACEHOLDER: Bilingual = { en: "target", ru: "цель" };

export const WORKBENCHES: Partial<Record<string, WorkbenchProfile>> = {
  nmap: {
    runner: "nmap",
    targetKind: "network",
    targetPlaceholder: { en: "IP, CIDR or hostname", ru: "IP, CIDR или хост" },
    resultView: "ports",
    wired: true,
    presets: [
      {
        id: "sweep",
        label: { en: "Service sweep", ru: "Скан сервисов" },
        target: "127.0.0.1",
        args: ["-Pn", "-sV", "-p", "22,80,443"],
      },
      {
        id: "os",
        label: { en: "OS fingerprint", ru: "Определение ОС" },
        target: "127.0.0.1",
        args: ["-O", "-sV"],
      },
      {
        id: "scripts",
        label: { en: "Default NSE scripts", ru: "Стандартные NSE" },
        target: "127.0.0.1",
        args: ["-sV", "-sC"],
      },
      {
        id: "top100",
        label: { en: "Top 100 ports", ru: "Топ-100 портов" },
        target: "127.0.0.1",
        args: ["--top-ports", "100"],
      },
    ],
    chips: [
      { id: "pn", label: { en: "-Pn", ru: "-Pn" }, args: ["-Pn"] },
      { id: "sv", label: { en: "-sV", ru: "-sV" }, args: ["-sV"] },
      { id: "sc", label: { en: "-sC", ru: "-sC" }, args: ["-sC"] },
      { id: "os", label: { en: "-O", ru: "-O" }, args: ["-O"] },
      { id: "ss", label: { en: "-sS", ru: "-sS" }, args: ["-sS"] },
      { id: "st", label: { en: "-sT", ru: "-sT" }, args: ["-sT"] },
      { id: "su", label: { en: "-sU", ru: "-sU" }, args: ["-sU"] },
      { id: "open", label: { en: "--open", ru: "--open" }, args: ["--open"] },
      { id: "v", label: { en: "-v", ru: "-v" }, args: ["-v"] },
      { id: "ports", label: { en: "-p 80,443", ru: "-p 80,443" }, args: ["-p", "80,443"] },
    ],
  },

  netcat: {
    runner: "nc",
    targetKind: "network",
    targetPlaceholder: { en: "hostname or IP", ru: "хост или IP" },
    resultView: "ports",
    wired: true,
    presets: [
      {
        id: "web",
        label: { en: "Web ports", ru: "Веб-порты" },
        target: "127.0.0.1",
        args: ["-z", "-v", "-w", "2", "80,443"],
      },
      {
        id: "mail",
        label: { en: "Mail ports", ru: "Почтовые порты" },
        target: "127.0.0.1",
        args: ["-z", "-v", "-w", "2", "25,110,143,993"],
      },
      {
        id: "fast",
        label: { en: "Quick sweep", ru: "Быстрый скан" },
        target: "127.0.0.1",
        args: ["-z", "-n", "-v", "-w", "1", "22,80,443,3000"],
      },
      {
        id: "db",
        label: { en: "Databases", ru: "Базы данных" },
        target: "127.0.0.1",
        args: ["-z", "-v", "-w", "2", "3306,5432,6379,27017"],
      },
    ],
    chips: [
      { id: "z", label: { en: "-z", ru: "-z" }, args: ["-z"] },
      { id: "n", label: { en: "-n", ru: "-n" }, args: ["-n"] },
      { id: "v", label: { en: "-v", ru: "-v" }, args: ["-v"] },
      { id: "4", label: { en: "-4", ru: "-4" }, args: ["-4"] },
      { id: "6", label: { en: "-6", ru: "-6" }, args: ["-6"] },
    ],
  },

  dig: {
    runner: "dig",
    targetKind: "hostname",
    targetPlaceholder: { en: "domain, e.g. example.com", ru: "домен, напр. example.com" },
    resultView: "records",
    wired: true,
    presets: [
      { id: "a", label: { en: "A records", ru: "A-записи" }, target: "example.com", args: ["+noall", "+answer", "-t", "A"] },
      { id: "mx", label: { en: "MX", ru: "MX" }, target: "example.com", args: ["+noall", "+answer", "-t", "MX"] },
      { id: "txt", label: { en: "TXT", ru: "TXT" }, target: "example.com", args: ["+noall", "+answer", "-t", "TXT"] },
      { id: "ns", label: { en: "NS", ru: "NS" }, target: "example.com", args: ["+noall", "+answer", "-t", "NS"] },
      { id: "any", label: { en: "ANY", ru: "ANY" }, target: "example.com", args: ["+noall", "+answer", "-t", "ANY"] },
      { id: "trace", label: { en: "Full trace", ru: "Полный trace" }, target: "example.com", args: ["+trace"] },
    ],
    chips: [
      { id: "noall", label: { en: "+noall", ru: "+noall" }, args: ["+noall"] },
      { id: "answer", label: { en: "+answer", ru: "+answer" }, args: ["+answer"] },
      { id: "short", label: { en: "+short", ru: "+short" }, args: ["+short"] },
      { id: "trace", label: { en: "+trace", ru: "+trace" }, args: ["+trace"] },
    ],
  },

  host: {
    runner: "host",
    targetKind: "hostname",
    targetPlaceholder: { en: "domain or IP", ru: "домен или IP" },
    resultView: "records",
    wired: true,
    presets: [
      { id: "addr", label: { en: "Address lookup", ru: "Поиск адреса" }, target: "example.com", args: [] },
      { id: "mx", label: { en: "MX", ru: "MX" }, target: "example.com", args: ["-t", "MX"] },
      { id: "ns", label: { en: "NS", ru: "NS" }, target: "example.com", args: ["-t", "NS"] },
      { id: "txt", label: { en: "TXT", ru: "TXT" }, target: "example.com", args: ["-t", "TXT"] },
      { id: "all", label: { en: "Everything (-a)", ru: "Всё (-a)" }, target: "example.com", args: ["-a"] },
    ],
    chips: [
      { id: "a", label: { en: "-a", ru: "-a" }, args: ["-a"] },
      { id: "d", label: { en: "-d", ru: "-d" }, args: ["-d"] },
      { id: "v", label: { en: "-v", ru: "-v" }, args: ["-v"] },
    ],
  },

  whois: {
    runner: "whois",
    targetKind: "hostname",
    targetPlaceholder: { en: "domain or IP", ru: "домен или IP" },
    resultView: "whois",
    wired: true,
    presets: [
      { id: "reg", label: { en: "Registry data", ru: "Данные регистратора" }, target: "example.com", args: [] },
      { id: "plain", label: { en: "No disclaimers", ru: "Без дисклеймеров" }, target: "example.com", args: ["-H"] },
    ],
    chips: [{ id: "h", label: { en: "-H", ru: "-H" }, args: ["-H"] }],
  },

  sherlock: {
    runner: "sherlock",
    targetKind: "username",
    targetPlaceholder: { en: "username, e.g. octocat", ru: "username, напр. octocat" },
    resultView: "found",
    wired: true,
    presets: [
      { id: "found", label: { en: "Find profiles", ru: "Найти профили" }, target: "octocat", args: ["--print-found", "--timeout", "5"] },
      { id: "all", label: { en: "Everything", ru: "Все сайты" }, target: "octocat", args: ["--print-all", "--timeout", "5"] },
    ],
    chips: [
      { id: "found", label: { en: "--print-found", ru: "--print-found" }, args: ["--print-found"] },
      { id: "all", label: { en: "--print-all", ru: "--print-all" }, args: ["--print-all"] },
      { id: "noc", label: { en: "--no-color", ru: "--no-color" }, args: ["--no-color"] },
      { id: "to5", label: { en: "--timeout 5", ru: "--timeout 5" }, args: ["--timeout", "5"] },
    ],
  },

  curl: {
    runner: "curl",
    targetKind: "hostname",
    targetPlaceholder: { en: "http(s) URL", ru: "http(s) URL" },
    resultView: "plain",
    wired: true,
    presets: [
      { id: "headers", label: { en: "Headers only", ru: "Только заголовки" }, target: "http://localhost:3000", args: ["-I", "-s", "-L"] },
      { id: "follow", label: { en: "Follow redirects", ru: "Редиректы" }, target: "http://localhost:3000", args: ["-s", "-L", "--max-redirs", "3"] },
      { id: "nobody", label: { en: "No body", ru: "Без тела" }, target: "http://localhost:3000", args: ["-s", "-o", "/dev/null"] },
    ],
    chips: [
      { id: "i", label: { en: "-I", ru: "-I" }, args: ["-I"] },
      { id: "s", label: { en: "-s", ru: "-s" }, args: ["-s"] },
      { id: "l", label: { en: "-L", ru: "-L" }, args: ["-L"] },
    ],
  },
};

export function getWorkbench(tool: Tool): WorkbenchProfile {
  const wb = WORKBENCHES[tool.id];
  if (wb) return wb;
  return {
    runner: tool.command.split(/\s+/)[0] ?? tool.id,
    targetKind: "hostname",
    targetPlaceholder: DEFAULT_PLACEHOLDER,
    resultView: "plain",
    wired: false,
    presets: [{ id: "run", label: { en: "Default run", ru: "Запуск по умолчанию" }, target: "", args: [] }],
    chips: [],
  };
}
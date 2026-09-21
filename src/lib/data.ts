export interface Person {
  id: string;
  name: string;
  role: string;
  city: string;
  region: string; // "IN-MH" | "DE" | ...
  tz: string; // IANA
  isViewer: boolean;
}

export type StatusKind = "around" | "off" | "away";

export interface Status {
  id: string;
  personId: string;
  kind: StatusKind;
  from: string; // YYYY-MM-DD
  to: string;
  note?: string;
  source: "tap" | "paste" | "seed";
  createdAt: number;
}

export interface Holiday {
  region: string;
  name: string;
  date: string;
  source: "seed" | "firecrawl";
}

export interface Parsed {
  personName?: string;
  kind: StatusKind;
  from: string;
  to: string;
  note?: string;
}

export function iso(offsetDays = 0): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return t.toISOString().slice(0, 10);
}

export function addDays(dateISO: string, days: number): string {
  const t = new Date(dateISO + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function coversToday(s: Status): boolean {
  const t = iso();
  return s.from <= t && s.to >= t;
}

// Live local time in a person's timezone. `tick` (ms epoch) is passed in so
// React re-renders drive the refresh.
export function localTime(tz: string, tick: number): { h: number; m: number; label: string } {
  const d = new Date(tick);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.format(d); // "HH:MM"
  const [h, m] = parts.split(":").map((x) => parseInt(x, 10));
  return { h, m, label: parts };
}

export function localHour(tz: string, tick: number): number {
  return localTime(tz, tick).h;
}

export function dayPhase(h: number): "sun" | "dusk" | "moon" {
  if (h >= 6 && h < 18) return "sun";
  if (h >= 18 && h < 21) return "dusk";
  return "moon";
}

export function isQuiet(h: number): boolean {
  return h >= 21 || h < 7;
}

// Shift-aware: outside their working hours (overnight shifts wrap).
export function isOffShift(workStart: number, workEnd: number, h: number): boolean {
  if (workStart === workEnd) return false;
  if (workStart < workEnd) return h < workStart || h >= workEnd;
  return h < workStart && h >= workEnd; // overnight wrap (22 → 6)
}

export function shiftLabel(workStart: number, workEnd: number): string {
  const f = (x: number) => String(((x % 24) + 24) % 24).padStart(2, "0") + ":00";
  return `${f(workStart)}–${f(workEnd)}`;
}

export function avatarUrl(name: string): string {
  const palette = ["dce7fb", "f9e0d4", "e2f0d9", "f3e8fb", "fbe9d0", "d9f2f0"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[h % palette.length];
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=${bg}`;
}

export function localDateISO(tz: string, tick: number): string {
  const d = new Date(tick);
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
}

export function fmtDate(dateISO: string): string {
  return new Date(dateISO + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export const REGION_LABELS: Record<string, string> = {
  "IN-MH": "Maharashtra",
  "IN-MP": "Madhya Pradesh",
  "IN-KA": "Karnataka",
  "IN": "India",
  "US-TX": "Texas",
  "US": "USA",
  "GB": "UK",
  "DE": "Germany",
  "PH": "Philippines",
  "BR": "Brazil",
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}

// Light/dark theme, persisted. Default dark.
export function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("wb-theme", t); } catch { /* private mode */ }
}

export function initTheme() {
  let t: "dark" | "light" = "dark";
  try { t = (localStorage.getItem("wb-theme") as "dark" | "light") ?? "dark"; } catch { /* private mode */ }
  applyTheme(t);
}

export function toggleTheme(): "dark" | "light" {
  const t = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(t);
  return t;
}

// Seed team — fictional people, real timezone spread.
export const TEAM: Person[] = [
  { id: "arjun", name: "Arjun Mehta", role: "Founder", city: "Pune", region: "IN-MH", tz: "Asia/Kolkata", isViewer: true },
  { id: "sana", name: "Sana Kulkarni", role: "Product", city: "Pune", region: "IN-MH", tz: "Asia/Kolkata", isViewer: false },
  { id: "pankaj", name: "Pankaj Rao", role: "PM", city: "Bhopal", region: "IN-MP", tz: "Asia/Kolkata", isViewer: false },
  { id: "meera", name: "Meera Iyer", role: "Design", city: "Bengaluru", region: "IN-KA", tz: "Asia/Kolkata", isViewer: false },
  { id: "greg", name: "Greg Palmer", role: "Engineering", city: "Austin", region: "US-TX", tz: "America/Chicago", isViewer: false },
  { id: "tom", name: "Tom Whitfield", role: "Engineering", city: "London", region: "GB", tz: "Europe/London", isViewer: false },
  { id: "lena", name: "Lena Fischer", role: "Ops", city: "Berlin", region: "DE", tz: "Europe/Berlin", isViewer: false },
  { id: "marco", name: "Marco Dela Cruz", role: "Support", city: "Manila", region: "PH", tz: "Asia/Manila", isViewer: false },
  { id: "ana", name: "Ana Souza", role: "Marketing", city: "São Paulo", region: "BR", tz: "America/Sao_Paulo", isViewer: false },
];

let n = 0;
export function seedStatuses(): Status[] {
  return [
    { id: `s${n++}`, personId: "sana", kind: "off", from: iso(0), to: iso(0), note: "family thing", source: "seed", createdAt: Date.now() - 5000 },
    { id: `s${n++}`, personId: "greg", kind: "away", from: iso(0), to: iso(5), note: "PTO — Big Bend", source: "seed", createdAt: Date.now() - 4000 },
    { id: `s${n++}`, personId: "ana", kind: "away", from: iso(2), to: iso(4), note: "conference in Rio", source: "seed", createdAt: Date.now() - 3000 },
  ];
}

export const SEED_HOLIDAYS: Holiday[] = [
  { region: "IN-MH", name: "Anant Chaturdashi (Ganesh visarjan)", date: iso(4), source: "seed" },
  { region: "IN", name: "Gandhi Jayanti", date: iso(11), source: "seed" },
  { region: "DE", name: "Tag der Deutschen Einheit", date: iso(12), source: "seed" },
  { region: "IN-KA", name: "Mahalaya Amavasya", date: iso(25), source: "seed" },
  { region: "US-TX", name: "Indigenous Peoples' Day", date: iso(21), source: "seed" },
  { region: "PH", name: "All Saints' Day", date: iso(41), source: "seed" },
];

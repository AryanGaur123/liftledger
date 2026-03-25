/**
 * Analytics engine for powerlifting training data.
 * Handles parsing, block detection, and weekly metric calculation.
 */

import { normalizeLift, type LiftCategory, type LiftMapping } from "./lifts";

// ── Raw data types ──

export interface RawRow {
  date?: string;
  exercise?: string;
  sets?: string | number;
  reps?: string | number;
  weight?: string | number;
  rpe?: string | number;
  notes?: string;
  [key: string]: unknown;
}

// ── Parsed types ──

export interface ParsedSet {
  date: Date;
  dateStr: string;
  weekLabel: string;
  exercise: string;
  liftMapping: LiftMapping;
  sets: number;
  reps: number;
  weight: number;
  tonnage: number;
  totalReps: number;
  rpe: number | null;
}

export interface WeeklyLiftMetrics {
  weekLabel: string;
  weekStart: Date;
  canonical: string;
  category: LiftCategory;
  totalSets: number;
  totalReps: number;
  totalTonnage: number;
  avgWeight: number;
  topWeight: number;
  avgRpe: number | null;
  setCount: number;
}

export interface BlockInfo {
  name: string;
  startDate: Date;
  endDate: Date;
  weekCount: number;
  weeks: string[];
}

export interface AnalysisResult {
  parsedSets: ParsedSet[];
  blocks: BlockInfo[];
  latestBlock: BlockInfo;
  weeklyMetrics: WeeklyLiftMetrics[];
  liftSummary: Record<
    string,
    {
      canonical: string;
      category: LiftCategory;
      totalSets: number;
      totalReps: number;
      totalTonnage: number;
      topWeight: number;
    }
  >;
  allLifts: string[];
  allWeeks: string[];
}

// ── Column detection ──

const DATE_ALIASES = ["date", "day", "training date", "session", "workout date", "datum"];
const EXERCISE_ALIASES = [
  "exercise", "movement", "lift", "name", "exercise name", "exercises",
  "übung", "exercice",
];
const SETS_ALIASES = ["sets", "set", "s", "working sets", "work sets"];
const REPS_ALIASES = ["reps", "rep", "r", "repetitions", "reps/set", "reps per set"];
const WEIGHT_ALIASES = [
  "weight", "load", "kg", "lbs", "lb", "weight (kg)", "weight (lbs)",
  "gewicht", "poids",
];
const RPE_ALIASES = ["rpe", "rir", "intensity", "effort"];

function matchColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "")
  );
  for (const alias of aliases) {
    const norm = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normalized.indexOf(norm);
    if (idx >= 0) return idx;
  }
  // Partial match
  for (const alias of aliases) {
    const norm = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
    const idx = normalized.findIndex((h) => h.includes(norm) || norm.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

interface ColumnMap {
  date: number;
  exercise: number;
  sets: number;
  reps: number;
  weight: number;
  rpe: number;
}

export function detectColumns(headers: string[]): ColumnMap {
  return {
    date: matchColumn(headers, DATE_ALIASES),
    exercise: matchColumn(headers, EXERCISE_ALIASES),
    sets: matchColumn(headers, SETS_ALIASES),
    reps: matchColumn(headers, REPS_ALIASES),
    weight: matchColumn(headers, WEIGHT_ALIASES),
    rpe: matchColumn(headers, RPE_ALIASES),
  };
}

// ── Date parsing ──

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  
  // Handle Excel serial dates (number)
  if (typeof raw === "number") {
    // Excel serial: days since 1899-12-30
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + raw);
    if (!isNaN(epoch.getTime())) return epoch;
    return null;
  }
  
  const str = String(raw).trim();
  if (!str) return null;

  // Try native parse first
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + parseInt(dmy[3]) : parseInt(dmy[3]);
    // Try MM/DD first if month <= 12, then DD/MM
    const m1 = parseInt(dmy[1]);
    const m2 = parseInt(dmy[2]);
    if (m1 <= 12) {
      const attempt = new Date(year, m1 - 1, m2);
      if (!isNaN(attempt.getTime())) return attempt;
    }
    if (m2 <= 12) {
      const attempt = new Date(year, m2 - 1, m1);
      if (!isNaN(attempt.getTime())) return attempt;
    }
  }

  return null;
}

// ── Number parsing ──

function parseNum(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const str = String(raw).trim().replace(/,/g, ".");
  
  // Handle "3x5" format (sets x reps)
  const sxr = str.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (sxr) return parseInt(sxr[1]) * parseInt(sxr[2]);
  
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// ── Week calculation ──

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const month = weekStart.toLocaleDateString("en-US", { month: "short" });
  const day = weekStart.getDate();
  return `${month} ${day}`;
}

// ── Block detection ──

function detectBlocks(parsedSets: ParsedSet[]): BlockInfo[] {
  if (parsedSets.length === 0) return [];

  // Group by week
  const weekMap = new Map<string, { start: Date; sets: ParsedSet[] }>();
  for (const s of parsedSets) {
    const ws = getWeekStart(s.date);
    const key = ws.toISOString().slice(0, 10);
    if (!weekMap.has(key)) {
      weekMap.set(key, { start: ws, sets: [] });
    }
    weekMap.get(key)!.sets.push(s);
  }

  const sortedWeeks = Array.from(weekMap.entries()).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  if (sortedWeeks.length === 0) return [];

  // Split into blocks: gap > 2 weeks = new block
  const blocks: BlockInfo[] = [];
  let blockWeeks: typeof sortedWeeks = [sortedWeeks[0]];

  for (let i = 1; i < sortedWeeks.length; i++) {
    const prevDate = new Date(sortedWeeks[i - 1][0]);
    const currDate = new Date(sortedWeeks[i][0]);
    const gapDays =
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (gapDays > 21) {
      // Finalize previous block
      blocks.push(buildBlock(blockWeeks, blocks.length + 1));
      blockWeeks = [sortedWeeks[i]];
    } else {
      blockWeeks.push(sortedWeeks[i]);
    }
  }
  blocks.push(buildBlock(blockWeeks, blocks.length + 1));

  return blocks;
}

function buildBlock(
  weeks: [string, { start: Date; sets: ParsedSet[] }][],
  num: number
): BlockInfo {
  const weekLabels = weeks.map(([, w]) => formatWeekLabel(w.start));
  return {
    name: `Block ${num}`,
    startDate: weeks[0][1].start,
    endDate: new Date(
      Math.max(...weeks.map(([, w]) => Math.max(...w.sets.map((s) => s.date.getTime()))))
    ),
    weekCount: weeks.length,
    weeks: weekLabels,
  };
}

// ── Main analysis ──

export function analyzeTrainingData(
  rows: unknown[][],
  headers: string[]
): AnalysisResult {
  const cols = detectColumns(headers);

  // Validate we have minimum required columns
  if (cols.exercise < 0) {
    throw new Error(
      "Could not find an exercise/movement column. Ensure your spreadsheet has headers like 'Exercise', 'Movement', or 'Lift'."
    );
  }

  const parsedSets: ParsedSet[] = [];
  let lastDate: Date | null = null;

  for (const row of rows) {
    // Parse date (use last known date if this row doesn't have one)
    const rawDate = cols.date >= 0 ? row[cols.date] : null;
    const date = parseDate(rawDate) || lastDate;
    if (rawDate && parseDate(rawDate)) {
      lastDate = parseDate(rawDate);
    }
    if (!date) continue;

    // Parse exercise
    const rawExercise = cols.exercise >= 0 ? String(row[cols.exercise] || "").trim() : "";
    if (!rawExercise) continue;

    // Parse numeric fields
    const sets = parseNum(cols.sets >= 0 ? row[cols.sets] : 1) || 1;
    const reps = parseNum(cols.reps >= 0 ? row[cols.reps] : null);
    const weight = parseNum(cols.weight >= 0 ? row[cols.weight] : null);
    const rpe = cols.rpe >= 0 ? parseNum(row[cols.rpe]) : null;

    if (reps === null || reps <= 0) continue;
    const w = weight || 0;

    const liftMapping = normalizeLift(rawExercise);
    const weekStart = getWeekStart(date);
    const totalReps = sets * reps;
    const tonnage = w * totalReps;

    parsedSets.push({
      date,
      dateStr: date.toISOString().slice(0, 10),
      weekLabel: formatWeekLabel(weekStart),
      exercise: rawExercise,
      liftMapping,
      sets,
      reps,
      weight: w,
      tonnage,
      totalReps,
      rpe,
    });
  }

  // Sort by date
  parsedSets.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Detect blocks
  const blocks = detectBlocks(parsedSets);
  const latestBlock = blocks[blocks.length - 1] || {
    name: "Current Block",
    startDate: new Date(),
    endDate: new Date(),
    weekCount: 0,
    weeks: [],
  };

  // Filter to latest block
  const blockSets = parsedSets.filter(
    (s) => s.date >= latestBlock.startDate && s.date <= latestBlock.endDate
  );

  // Calculate weekly metrics per lift
  const weekLiftMap = new Map<string, WeeklyLiftMetrics>();
  for (const s of blockSets) {
    const key = `${s.weekLabel}::${s.liftMapping.canonical}`;
    if (!weekLiftMap.has(key)) {
      weekLiftMap.set(key, {
        weekLabel: s.weekLabel,
        weekStart: getWeekStart(s.date),
        canonical: s.liftMapping.canonical,
        category: s.liftMapping.category,
        totalSets: 0,
        totalReps: 0,
        totalTonnage: 0,
        avgWeight: 0,
        topWeight: 0,
        avgRpe: null,
        setCount: 0,
      });
    }
    const m = weekLiftMap.get(key)!;
    m.totalSets += s.sets;
    m.totalReps += s.totalReps;
    m.totalTonnage += s.tonnage;
    m.topWeight = Math.max(m.topWeight, s.weight);
    m.setCount++;
    if (s.rpe !== null) {
      m.avgRpe = m.avgRpe === null ? s.rpe : (m.avgRpe * (m.setCount - 1) + s.rpe) / m.setCount;
    }
  }

  // Calculate avg weight per weekly metric
  for (const m of weekLiftMap.values()) {
    m.avgWeight = m.totalReps > 0 ? m.totalTonnage / m.totalReps : 0;
    if (m.avgRpe !== null) m.avgRpe = Math.round(m.avgRpe * 10) / 10;
  }

  const weeklyMetrics = Array.from(weekLiftMap.values()).sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
  );

  // Build lift summary (block totals)
  const liftSummary: AnalysisResult["liftSummary"] = {};
  for (const m of weeklyMetrics) {
    if (!liftSummary[m.canonical]) {
      liftSummary[m.canonical] = {
        canonical: m.canonical,
        category: m.category,
        totalSets: 0,
        totalReps: 0,
        totalTonnage: 0,
        topWeight: 0,
      };
    }
    const s = liftSummary[m.canonical];
    s.totalSets += m.totalSets;
    s.totalReps += m.totalReps;
    s.totalTonnage += m.totalTonnage;
    s.topWeight = Math.max(s.topWeight, m.topWeight);
  }

  const allLifts = Array.from(new Set(weeklyMetrics.map((m) => m.canonical))).sort();
  const allWeeks = Array.from(new Set(weeklyMetrics.map((m) => m.weekLabel)));

  return {
    parsedSets: blockSets,
    blocks,
    latestBlock,
    weeklyMetrics,
    liftSummary,
    allLifts,
    allWeeks,
  };
}

/**
 * Spreadsheet parser.
 *
 * Handles TWO formats:
 *
 * 1. ARYAN-GAUR custom template (auto-detected):
 *    - Each sheet = one training block (e.g. "4 WEEKS OUT B12")
 *    - Weeks are sections: row pattern [null,...,"Weeks Out", N, <serial_date>,...,"Week N"]
 *    - Header row: [null,null,null,"Day","Movement","Tempo","Sets","Reps","Load (KG)",...]
 *    - Day rows: [null,null,null,"MONDAY",<exercise>,...]
 *    - Exercise rows: [null,null,null,null,<exercise>,<tempo>,<sets>,<reps>,<load>,...]
 *
 * 2. Generic flat table: standard rows with headers on the first non-empty row.
 */

import * as XLSX from "xlsx";
import { detectColumns } from "./analytics";

export interface SheetData {
  headers: string[];
  rows: unknown[][];
  sheetName: string;
}

// ── Format detection ──────────────────────────────────────────────────────────

function isAryanTemplate(data: unknown[][]): boolean {
  // Look for the characteristic "Weeks Out" pattern or the fixed header row
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i] as unknown[];
    if (!row) continue;
    // "Weeks Out" marker
    if (row.some((c) => String(c ?? "").trim().toLowerCase() === "weeks out")) return true;
    // Fixed header: Day, Movement, Sets, Reps in specific columns
    if (
      String(row[3] ?? "").trim().toLowerCase() === "day" &&
      String(row[4] ?? "").trim().toLowerCase() === "movement"
    ) return true;
  }
  return false;
}

// ── Excel serial date ─────────────────────────────────────────────────────────

function serialToDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  epoch.setDate(epoch.getDate() + Math.floor(serial));
  return epoch;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Day-of-week → offset from week start (Monday) ───────────────────────────

const DAY_OFFSETS: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function dayOffset(dayLabel: string): number {
  const key = dayLabel.trim().toLowerCase().replace(/\s+/g, "");
  for (const [name, offset] of Object.entries(DAY_OFFSETS)) {
    if (key.startsWith(name)) return offset;
  }
  return 0;
}

// ── Parse Aryan-template sheet ───────────────────────────────────────────────

interface FlatRow {
  date: Date;
  weekLabel: string;
  dayLabel: string;
  movement: string;
  sets: number;
  reps: number;
  loadKg: number;
  loadUnit: 'lbs' | 'kg';
  rpe: number | null;
  volume: number | null;
  blockName?: string;
}

function parseAryanSheet(data: unknown[][], sheetName: string): FlatRow[] {
  const rows: FlatRow[] = [];

  let currentWeekStart: Date | null = null;
  let currentDay = "Monday";
  let loadUnit: 'lbs' | 'kg' = 'kg';

  for (let i = 0; i < data.length; i++) {
    const row = (data[i] as unknown[]) ?? [];

    // Skip totally empty rows
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;

    // Week header row: contains "Weeks Out" + a serial date
    const weeksOutIdx = row.findIndex(
      (c) => String(c ?? "").trim().toLowerCase() === "weeks out"
    );
    if (weeksOutIdx >= 0) {
      // The serial date is typically 2 cells after "Weeks Out"
      const serial = row[weeksOutIdx + 2];
      if (typeof serial === "number" && serial > 40000 && serial < 60000) {
        const raw = serialToDate(serial);
        currentWeekStart = getWeekStart(raw);
      }
      continue;
    }

    // Column header row — detect load unit then skip
    if (
      String(row[3] ?? "").trim().toLowerCase() === "day" &&
      String(row[4] ?? "").trim().toLowerCase() === "movement"
    ) {
      const loadHeader = String(row[8] ?? "").toLowerCase();
      loadUnit = loadHeader.includes("lbs") ? "lbs" : "kg";
      continue;
    }

    // Day label row (MONDAY, WEDNESDAY, etc.) — col 3 has the day name
    const col3 = String(row[3] ?? "").trim();
    if (col3 && /^(mon|tue|wed|thu|fri|sat|sun)/i.test(col3)) {
      currentDay = col3;
    }

    // Exercise row — col 4 has the movement name
    const movement = String(row[4] ?? "").trim();
    if (!movement || movement === "Movement") continue;

    // Skip feedback/notes rows
    if (
      /^(sleep|stress|nutrition|recovery|strength|feedback|notes|week\s*\d)/i.test(movement) ||
      movement.length < 2
    ) continue;

    // Parse numeric columns: Sets(6), Reps(7), Load(8), Actual RPE(10), Volume(11)
    const sets = toNum(row[6]) ?? 1;
    const reps = toNum(row[7]);
    const loadKg = toNum(row[8]) ?? 0;
    const actualRpe = toNum(row[10]);
    const volume = toNum(row[11]);

    if (reps === null || reps <= 0) continue;

    // Calculate the date for this exercise
    if (!currentWeekStart) continue;

    const offset = dayOffset(currentDay);
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + offset);

    rows.push({
      date,
      weekLabel: formatWeekLabel(currentWeekStart),
      dayLabel: currentDay,
      movement,
      sets,
      reps,
      loadKg,
      loadUnit,
      rpe: actualRpe,
      volume,
      // blockName injected by caller
    });
  }

  return rows;
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const n = parseFloat(String(val).replace(/,/g, "."));
  return isNaN(n) ? null : n;
}

// ── Convert FlatRows → SheetData (generic flat table format) ─────────────────

function flatRowsToSheetData(rows: FlatRow[], sheetName: string): SheetData {
  const headers = ["date", "exercise", "sets", "reps", "weight", "rpe", "volume"];
  const dataRows = rows.map((r) => [
    r.date.toISOString().slice(0, 10),
    r.movement,
    r.sets,
    r.reps,
    r.loadKg,
    r.rpe,
    r.volume,
  ]);
  return { headers, rows: dataRows, sheetName };
}

// ── Score a sheet for "best" selection ───────────────────────────────────────

function scoreGenericSheet(headers: string[]): number {
  const cols = detectColumns(headers);
  let score = 0;
  if (cols.exercise >= 0) score += 3;
  if (cols.date >= 0) score += 2;
  if (cols.weight >= 0) score += 2;
  if (cols.reps >= 0) score += 2;
  if (cols.sets >= 0) score += 1;
  return score;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Find the best sheet to use and parse it into SheetData.
 * Handles both the Aryan-Gaur custom template and generic flat tables.
 */
export function parseXlsxBuffer(buffer: Buffer): SheetData {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });

  // Skip utility sheets
  const skip = /^(notes|rpe chart|attempts)/i;
  const candidates = workbook.SheetNames.filter((n) => !skip.test(n));

  if (candidates.length === 0) {
    return { headers: [], rows: [], sheetName: workbook.SheetNames[0] ?? "Sheet1" };
  }

  // Check first candidate to detect format
  const firstSheet = workbook.Sheets[candidates[0]];
  const firstData = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1, raw: true, defval: null,
  }) as unknown[][];

  if (isAryanTemplate(firstData)) {
    // Custom block-per-sheet template: parse ALL sheets, tag each row with sheet name
    return parseMultiSheetWorkbook(workbook, candidates, true);
  }

  // Generic flat table — check if multiple sheets all look like training data
  const scoredSheets: { name: string; score: number; headers: string[]; data: unknown[][] }[] = [];

  for (const name of candidates) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
    if (data.length < 2) continue;
    const headers = (data[0] ?? []).map((c) => String(c ?? "").trim());
    const score = scoreGenericSheet(headers);
    if (score >= 3) { // must have at least exercise + one numeric column
      scoredSheets.push({ name, score, headers, data });
    }
  }

  // If multiple sheets look like training data, combine them all (multi-block)
  if (scoredSheets.length > 1) {
    return parseMultiSheetWorkbook(workbook, candidates, false);
  }

  // Single sheet — just return it
  const best = scoredSheets[0] ?? { name: candidates[0], headers: [], data: [] };
  if (!best.data || best.data.length === 0) {
    const ws = workbook.Sheets[best.name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown[][];
    best.headers = (data[0] ?? []).map((c) => String(c ?? "").trim());
    best.data = data;
  }
  const singleRows = (best.data.slice(1) as unknown[][]).filter(
    (r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim())
  );
  return { headers: best.headers, rows: singleRows, sheetName: best.name };
}

/**
 * Parse all candidate sheets from a workbook, tagging each row with its sheet name.
 * Returns a FlatRow[] (cast as SheetData) for block-aware analytics.
 */
function parseMultiSheetWorkbook(
  workbook: XLSX.WorkBook,
  candidates: string[],
  isCustomTemplate: boolean
): SheetData {
  if (isCustomTemplate) {
    // Custom template: use structural parser
    const allRows: FlatRow[] = [];
    for (const name of candidates) {
      const ws = workbook.Sheets[name];
      if (!ws) continue;
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
      const parsed = parseAryanSheet(data, name);
      for (const r of parsed) r.blockName = name;
      allRows.push(...parsed);
    }
    if (allRows.length === 0) return { headers: [], rows: [], sheetName: "All Blocks" };
    allRows.sort((a, b) => a.date.getTime() - b.date.getTime());
    return allRows as unknown as SheetData;
  } else {
    // Generic flat-table sheets: use first sheet's headers, combine all rows
    // Detect shared headers from the first valid sheet
    let sharedHeaders: string[] = [];
    const allRows: FlatRow[] = [];

    for (const name of candidates) {
      const ws = workbook.Sheets[name];
      if (!ws) continue;
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][];
      if (data.length < 2) continue;
      const headers = (data[0] ?? []).map((c) => String(c ?? "").trim());
      if (sharedHeaders.length === 0) sharedHeaders = headers;
      const score = scoreGenericSheet(headers);
      if (score < 3) continue;

      // Parse rows from this sheet as FlatRows using column detection
      const parsed = parseGenericSheetAsFlatRows(data, headers, name);
      for (const r of parsed) r.blockName = name;
      allRows.push(...parsed);
    }

    if (allRows.length === 0) return { headers: [], rows: [], sheetName: "All Blocks" };
    allRows.sort((a, b) => a.date.getTime() - b.date.getTime());
    return allRows as unknown as SheetData;
  }
}

/**
 * Parse a generic flat-table sheet into FlatRows using column detection.
 */
function parseGenericSheetAsFlatRows(data: unknown[][], headers: string[], sheetName: string): FlatRow[] {
  const cols = detectColumns(headers);
  if (cols.exercise < 0) return [];

  const rows: FlatRow[] = [];
  let lastDate: Date | null = null;

  for (const row of data.slice(1)) {
    if (!row || (row as any[]).every((c: unknown) => c === null || c === undefined || c === "")) continue;

    const rawDate = cols.date >= 0 ? (row as any[])[cols.date] : null;
    const parsedDate = rawDate ? parseGenericDate(rawDate) : null;
    const date = parsedDate || lastDate;
    if (parsedDate) lastDate = parsedDate;
    if (!date) continue;

    const movement = cols.exercise >= 0 ? String((row as any[])[cols.exercise] ?? "").trim() : "";
    if (!movement || movement.length < 2) continue;

    const sets = toNum(cols.sets >= 0 ? (row as any[])[cols.sets] : 1) ?? 1;
    const reps = toNum(cols.reps >= 0 ? (row as any[])[cols.reps] : null);
    const loadKg = toNum(cols.weight >= 0 ? (row as any[])[cols.weight] : null) ?? 0;
    const rpe = cols.rpe >= 0 ? toNum((row as any[])[cols.rpe]) : null;

    if (reps === null || reps <= 0) continue;

    const weekStart = getWeekStart(date);
    rows.push({
      date,
      weekLabel: formatWeekLabel(weekStart),
      dayLabel: "",
      movement,
      sets,
      reps,
      loadKg,
      loadUnit: "lbs" as const,
      rpe,
      volume: null,
    });
  }
  return rows;
}

function parseGenericDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + Math.floor(raw));
    return isNaN(epoch.getTime()) ? null : epoch;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  return null;
}

/**
 * Parse raw Google Sheets API values.
 * Detects the Aryan-Gaur template format automatically.
 */
export function parseGoogleSheetsValues(
  values: unknown[][],
  sheetName: string
): SheetData {
  if (!values || values.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  if (isAryanTemplate(values)) {
    const rows = parseAryanSheet(values, sheetName);
    return flatRowsToSheetData(rows, sheetName);
  }

  // Generic: first non-empty row is headers
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, values.length); i++) {
    const row = values[i];
    if (row?.some((c) => c !== null && c !== undefined && String(c).trim())) {
      headerIdx = i;
      break;
    }
  }

  const headers = (values[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const rows = values.slice(headerIdx + 1).filter(
    (r) => r?.some((c) => c !== null && c !== undefined && String(c).trim())
  );
  return { headers, rows, sheetName };
}

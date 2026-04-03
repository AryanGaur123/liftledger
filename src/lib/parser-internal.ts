/**
 * Internal parser for the Aryan-Gaur custom powerlifting template
 * when loaded via Google Sheets API (multi-sheet, UNFORMATTED_VALUE).
 */

export interface FlatRow {
  date: Date;
  weekLabel: string;
  dayLabel: string;
  movement: string;
  sets: number;
  reps: number;
  loadKg: number;
  rpe: number | null;
  volume: number | null;
  /** Sheet/block name this row came from (e.g. "B1", "B2") */
  blockName?: string;
}

const DAY_OFFSETS: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
};

function dayOffset(dayLabel: string): number {
  const key = dayLabel.trim().toLowerCase().replace(/\s+/g, "");
  for (const [name, offset] of Object.entries(DAY_OFFSETS)) {
    if (key.startsWith(name)) return offset;
  }
  return 0;
}

function serialToDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  epoch.setDate(epoch.getDate() + Math.floor(serial));
  return epoch;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const n = parseFloat(String(val).replace(/,/g, "."));
  return isNaN(n) ? null : n;
}

function parseSheet(values: unknown[][]): FlatRow[] {
  const rows: FlatRow[] = [];
  let currentWeekStart: Date | null = null;
  let currentDay = "Monday";

  for (let i = 0; i < values.length; i++) {
    const row = (values[i] as unknown[]) ?? [];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;

    // Week header: contains "Weeks Out" + serial date 2 cells later
    const weeksOutIdx = row.findIndex(
      (c) => String(c ?? "").trim().toLowerCase() === "weeks out"
    );
    if (weeksOutIdx >= 0) {
      const serial = row[weeksOutIdx + 2];
      if (typeof serial === "number" && serial > 40000 && serial < 60000) {
        currentWeekStart = getWeekStart(serialToDate(serial));
      }
      continue;
    }

    // Column header row — skip
    if (
      String(row[3] ?? "").trim().toLowerCase() === "day" &&
      String(row[4] ?? "").trim().toLowerCase() === "movement"
    ) continue;

    // Day label row
    const col3 = String(row[3] ?? "").trim();
    if (col3 && /^(mon|tue|wed|thu|fri|sat|sun)/i.test(col3)) {
      currentDay = col3;
    }

    // Exercise row
    const movement = String(row[4] ?? "").trim();
    if (!movement || movement.length < 2) continue;

    // Skip feedback/metadata rows
    if (/^(sleep|stress|nutrition|recovery|strength|feedback|notes|week\s*\d|movement|tempo)/i.test(movement)) continue;

    const sets = toNum(row[6]) ?? 1;
    const reps = toNum(row[7]);
    const loadKg = toNum(row[8]) ?? 0;
    const actualRpe = toNum(row[10]);
    const volume = toNum(row[11]);

    if (reps === null || reps <= 0 || !currentWeekStart) continue;

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
      rpe: actualRpe,
      volume,
    }); // blockName injected by caller
  }

  return rows;
}

/**
 * Parse a generic flat-table sheet (already fetched as rows+headers) into FlatRows.
 * Used for multi-sheet Google Sheets workbooks that aren't the custom template.
 */
export function parseGenericGoogleSheetsFlatRows(
  rows: unknown[][],
  headers: string[],
  sheetName: string
): FlatRow[] {
  // Inline column detection (mirrors analytics.ts detectColumns)
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nh = headers.map(normalize);
  const find = (aliases: string[]) => {
    for (const a of aliases) {
      const n = normalize(a);
      const i = nh.indexOf(n);
      if (i >= 0) return i;
    }
    for (const a of aliases) {
      const n = normalize(a);
      const i = nh.findIndex((h) => h.includes(n) || n.includes(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  const dateCol = find(["date", "day", "training date", "session"]);
  const exCol = find(["exercise", "movement", "lift", "name"]);
  const setsCol = find(["sets", "set", "working sets"]);
  const repsCol = find(["reps", "rep", "repetitions"]);
  const weightCol = find(["weight", "load", "kg", "lbs"]);
  const rpeCol = find(["rpe", "rir", "intensity"]);

  if (exCol < 0) return [];

  const result: FlatRow[] = [];
  let lastDate: Date | null = null;

  for (const row of rows) {
    const r = row as any[];
    if (!r || r.every((c) => c === null || c === undefined || c === "")) continue;

    const rawDate = dateCol >= 0 ? r[dateCol] : null;
    const parsedDate = rawDate ? parseRawDate(rawDate) : null;
    const date = parsedDate || lastDate;
    if (parsedDate) lastDate = parsedDate;
    if (!date) continue;

    const movement = String(r[exCol] ?? "").trim();
    if (!movement || movement.length < 2) continue;

    const sets = toNum(setsCol >= 0 ? r[setsCol] : 1) ?? 1;
    const reps = toNum(repsCol >= 0 ? r[repsCol] : null);
    const loadKg = toNum(weightCol >= 0 ? r[weightCol] : null) ?? 0;
    const rpe = rpeCol >= 0 ? toNum(r[rpeCol]) : null;

    if (reps === null || reps <= 0) continue;

    const weekStart = getWeekStart(date);
    result.push({
      date,
      weekLabel: formatWeekLabel(weekStart),
      dayLabel: "",
      movement,
      sets,
      reps,
      loadKg,
      rpe,
      volume: null,
    });
  }
  return result;
}

function parseRawDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "number") {
    const d = serialToDate(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return !isNaN(d.getTime()) && d.getFullYear() > 2000 ? d : null;
}

/**
 * Fetches all block sheets from Google Sheets API and parses them into FlatRows.
 */
export async function parseAllGoogleSheetBlocks(
  fileId: string,
  sheetNames: string[],
  accessToken: string
): Promise<FlatRow[]> {
  const allRows: FlatRow[] = [];

  for (const name of sheetNames) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(name)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const values: unknown[][] = data.values ?? [];
      const parsed = parseSheet(values);
      // Tag each row with the sheet (block) name
      for (const row of parsed) row.blockName = name;
      allRows.push(...parsed);
    } catch {
      // Skip sheets that fail to load
      continue;
    }
  }

  // Sort chronologically
  allRows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return allRows;
}

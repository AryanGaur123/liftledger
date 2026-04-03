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
    });
  }

  return rows;
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

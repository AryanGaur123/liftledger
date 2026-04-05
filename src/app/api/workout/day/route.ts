import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/workout/day?fileId=...&sheetName=...&dayLabel=MONDAY&weekIndex=0
 *
 * Returns exercises for a specific day in a block sheet,
 * plus feedback row mappings for the pre-workout check-in.
 */

const BARBELL_RE = /squat|bench|deadlift|press|row/i;
const NOT_BARBELL_RE = /db |dumbbell|cable|machine|curl|extension|lat pull|pull.?down|fly|pec deck|leg press|hack|goblet|split|lateral|rear delt|face pull|tricep|bicep|calf|ab\b|core|glute|hamstring|leg curl|leg ext/i;

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");
  const sheetName = url.searchParams.get("sheetName");
  const dayLabel = url.searchParams.get("dayLabel")?.toUpperCase();
  const weekIndex = parseInt(url.searchParams.get("weekIndex") || "0", 10);

  if (!fileId || !sheetName || !dayLabel) {
    return NextResponse.json({ error: "fileId, sheetName, and dayLabel required" }, { status: 400 });
  }

  const safeSheet = "'" + sheetName.replace(/'/g, "''") + "'";
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(safeSheet)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Sheets API: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  const values: unknown[][] = data.values ?? [];

  // Find week boundaries
  const weekStarts: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i] as any[];
    if (!row) continue;
    if (row.some((c: any) => String(c ?? "").trim().toLowerCase() === "weeks out")) {
      weekStarts.push(i);
    }
  }

  if (weekIndex >= weekStarts.length) {
    return NextResponse.json({ error: `Week ${weekIndex} not found` }, { status: 400 });
  }

  const weekStart = weekStarts[weekIndex];
  const weekEnd = weekIndex + 1 < weekStarts.length ? weekStarts[weekIndex + 1] : values.length;

  // Detect load unit from header row
  let loadUnit: "lbs" | "kg" = "kg";
  for (let i = weekStart; i < weekEnd; i++) {
    const row = values[i] as any[];
    if (row && String(row[3] ?? "").trim().toLowerCase() === "day") {
      loadUnit = String(row[8] ?? "").toLowerCase().includes("lbs") ? "lbs" : "kg";
      break;
    }
  }

  // Find the target day within this week
  const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  let dayStart = -1;
  let dayEnd = weekEnd;

  for (let i = weekStart; i < weekEnd; i++) {
    const row = values[i] as any[];
    if (!row) continue;
    const col3 = String(row[3] ?? "").trim().toUpperCase();

    if (col3 && DAY_NAMES.some((d) => col3.startsWith(d.slice(0, 3)))) {
      if (col3.startsWith(dayLabel.slice(0, 3))) {
        dayStart = i;
      } else if (dayStart >= 0) {
        dayEnd = i;
        break;
      }
    }
  }

  if (dayStart < 0) {
    return NextResponse.json({ error: `Day ${dayLabel} not found in week ${weekIndex}` }, { status: 404 });
  }

  interface Exercise {
    rowIndex: number;
    movement: string;
    tempo: string | null;
    sets: number;
    reps: number;
    load: number;
    loadUnit: "lbs" | "kg";
    prescribedRPE: string | null;
    actualRPE: number | null;
    isBarbell: boolean;
    dropFromLoad: number | null;
    notes: string | null;        // col 14 coach notes
  }

  interface FeedbackSlot {
    rowIndex: number;
    category: string;
    value: number | null;
  }

  const exercises: Exercise[] = [];
  const feedbackSlots: FeedbackSlot[] = [];

  for (let i = dayStart; i < dayEnd; i++) {
    const row = values[i] as any[];
    if (!row) continue;

    // Check feedback (col 12-13)
    const fbLabel = String(row[12] ?? "").trim();
    if (fbLabel && /^(Sleep|Stress|Nutrition|Recovery|Strength)$/i.test(fbLabel)) {
      feedbackSlots.push({
        rowIndex: i + 1,
        category: fbLabel.charAt(0).toUpperCase() + fbLabel.slice(1).toLowerCase(),
        value: typeof row[13] === "number" ? row[13] : null,
      });
    }

    // Check exercise (col 4)
    const movement = String(row[4] ?? "").trim();
    if (!movement || movement.length < 2) continue;
    if (/^(sleep|stress|nutrition|recovery|strength|feedback|notes|week\s*\d|day|movement|tempo)/i.test(movement)) continue;

    const sets = typeof row[6] === "number" ? row[6] : 1;
    const reps = typeof row[7] === "number" ? row[7] : 0;
    let load = typeof row[8] === "number" ? row[8] : 0;
    const prescribedRPE = row[9] != null ? String(row[9]) : null;
    const actualRPE = typeof row[10] === "number" ? row[10] : null;

    if (reps <= 0) continue;

    // Auto-calculate drop percentage loads
    // "Drop X%" in the RPE col with no load → find the most recent exercise
    // with the same base movement name and apply the percentage drop
    const dropMatch = prescribedRPE?.match(/drop\s*(\d+(?:\.\d+)?)%/i);
    let dropFromLoad: number | null = null;
    if (dropMatch && load === 0 && exercises.length > 0) {
      const dropPct = parseFloat(dropMatch[1]) / 100;
      const baseMovement = movement.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
      // Extract core keyword tokens (e.g. "squat", "bench", "deadlift") for fuzzy matching
      const tokens = baseMovement.split(/\s+/).filter(t => t.length > 3);
      for (let j = exercises.length - 1; j >= 0; j--) {
        const prev = exercises[j];
        const prevBase = prev.movement.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
        // Match if: exact base name OR one contains the other OR they share a key token
        const exactMatch = prevBase === baseMovement;
        const containsMatch = prevBase.includes(baseMovement) || baseMovement.includes(prevBase);
        const tokenMatch = tokens.some(t => prevBase.includes(t));
        if ((exactMatch || containsMatch || tokenMatch) && prev.load > 0) {
          dropFromLoad = prev.load;
          load = Math.round((prev.load * (1 - dropPct)) / 5) * 5;
          break;
        }
      }
    }

    exercises.push({
      rowIndex: i + 1,
      movement,
      tempo: row[5] != null ? String(row[5]).trim() || null : null,
      sets, reps, load, loadUnit, prescribedRPE, actualRPE,
      isBarbell: BARBELL_RE.test(movement) && !NOT_BARBELL_RE.test(movement),
      dropFromLoad: dropFromLoad,
      notes: row[14] != null ? String(row[14]).trim() || null : null,
    });
  }

  const checkInComplete = feedbackSlots.length >= 3 &&
    feedbackSlots.filter(fb => fb.value != null).length === feedbackSlots.length;

  return NextResponse.json({ sheetName, dayLabel, weekIndex, loadUnit, exercises, feedbackSlots, checkInComplete });
}

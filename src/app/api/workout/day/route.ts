import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/workout/day
 * Reads a specific day's exercises from a training block sheet.
 *
 * Query params: fileId, sheetName, dayLabel (e.g. "MONDAY")
 * Returns: exercises array with row numbers + feedback slot rows
 */

const BARBELL_PATTERN = /squat|bench|deadlift|press|row|pull/i;
const NOT_BARBELL_PATTERN = /\b(db|dumbbell|dumbell|cable|machine|curl|fly|flye|lateral|rear delt|face pull|tricep|bicep|leg curl|leg ext|hamstring|glute|calf|ab|core)\b/i;

function isBarbell(movement: string): boolean {
  if (NOT_BARBELL_PATTERN.test(movement)) return false;
  return BARBELL_PATTERN.test(movement);
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const n = parseFloat(String(val).replace(/,/g, "."));
  return isNaN(n) ? null : n;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get("fileId");
  const sheetName = searchParams.get("sheetName");
  const dayLabel = searchParams.get("dayLabel");

  if (!fileId || !sheetName || !dayLabel) {
    return NextResponse.json(
      { error: "fileId, sheetName, and dayLabel are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the full sheet data
    const safeTitle = "'" + sheetName.replace(/'/g, "''") + "'";
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(safeTitle)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error?.message || `Sheets API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const values: unknown[][] = data.values ?? [];

    // Parse: find the day's exercises and feedback slots
    let currentDay = "";
    let inTargetDay = false;
    let loadUnit: "lbs" | "kg" = "kg";
    const exercises: {
      rowIndex: number;
      movement: string;
      tempo: string;
      sets: number;
      reps: number;
      load: number;
      loadUnit: "lbs" | "kg";
      prescribedRPE: string;
      actualRPE: number | null;
      isBarbell: boolean;
    }[] = [];
    const feedbackSlots: Record<string, { row: number; value: number | null }> = {};

    for (let i = 0; i < values.length; i++) {
      const row = (values[i] as unknown[]) ?? [];

      // Column header row — detect load unit
      if (
        String(row[3] ?? "").trim().toLowerCase() === "day" &&
        String(row[4] ?? "").trim().toLowerCase() === "movement"
      ) {
        const loadHeader = String(row[8] ?? "").toLowerCase();
        loadUnit = loadHeader.includes("lbs") ? "lbs" : "kg";
        continue;
      }

      // Day label row
      const col3 = String(row[3] ?? "").trim();
      if (col3 && /^(mon|tue|wed|thu|fri|sat|sun)/i.test(col3)) {
        if (inTargetDay) {
          // We've hit the next day — stop
          // But first check for recovery/strength rows that come after last exercise
          // These are handled below as feedback rows with no movement
          break;
        }
        if (col3.toUpperCase() === dayLabel.toUpperCase()) {
          inTargetDay = true;
          currentDay = col3;
        }
        continue;
      }

      if (!inTargetDay) continue;

      // Check if this is a feedback row (col 12 = M has label, col 13 = N has value)
      const feedbackLabel = String(row[12] ?? "").trim().toLowerCase();
      if (feedbackLabel && /^(sleep|stress|nutrition|recovery|strength)$/.test(feedbackLabel)) {
        feedbackSlots[feedbackLabel] = {
          row: i + 1, // 1-indexed for Sheets API
          value: toNum(row[13]),
        };
      }

      // Exercise row — col 4 has the movement name
      const movement = String(row[4] ?? "").trim();
      if (!movement || movement.length < 2) continue;

      // Skip feedback/metadata rows that happened to have movement-like content
      if (/^(sleep|stress|nutrition|recovery|strength|feedback|notes|week\s*\d)/i.test(movement)) {
        continue;
      }

      exercises.push({
        rowIndex: i + 1, // 1-indexed for Sheets API
        movement,
        tempo: String(row[5] ?? "").trim(),
        sets: toNum(row[6]) ?? 1,
        reps: toNum(row[7]) ?? 0,
        load: toNum(row[8]) ?? 0,
        loadUnit,
        prescribedRPE: String(row[9] ?? "").trim(),
        actualRPE: toNum(row[10]),
        isBarbell: isBarbell(movement),
      });
    }

    // If we exited the loop without hitting the next day, we need to scan for
    // feedback rows that come after the last exercise (Recovery, Strength)
    if (inTargetDay) {
      const lastExerciseIdx = exercises.length > 0
        ? exercises[exercises.length - 1].rowIndex - 1
        : -1;
      for (let i = lastExerciseIdx + 1; i < values.length; i++) {
        const row = (values[i] as unknown[]) ?? [];
        const col3 = String(row[3] ?? "").trim();
        // Stop if we hit another day label or a new section
        if (col3 && /^(mon|tue|wed|thu|fri|sat|sun)/i.test(col3)) break;
        // Stop on blank rows that suggest a new week section
        const weeksOutIdx = row.findIndex(
          (c) => String(c ?? "").trim().toLowerCase() === "weeks out"
        );
        if (weeksOutIdx >= 0) break;

        const feedbackLabel = String(row[12] ?? "").trim().toLowerCase();
        if (feedbackLabel && /^(sleep|stress|nutrition|recovery|strength)$/.test(feedbackLabel)) {
          feedbackSlots[feedbackLabel] = {
            row: i + 1,
            value: toNum(row[13]),
          };
        }
      }
    }

    return NextResponse.json({
      exercises,
      feedbackSlots,
      loadUnit,
      dayLabel: currentDay || dayLabel,
    });
  } catch (err: any) {
    console.error("Workout day fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch day data" },
      { status: 500 }
    );
  }
}

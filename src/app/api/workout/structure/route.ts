import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/workout/structure?fileId=...&sheetName=...
 *
 * Returns the week + day structure of a block sheet.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");
  const sheetName = url.searchParams.get("sheetName");

  if (!fileId || !sheetName) {
    return NextResponse.json({ error: "fileId and sheetName required" }, { status: 400 });
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

  const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

  // Find all week boundaries
  const weekStarts: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i] as any[];
    if (!row) continue;
    if (row.some((c: any) => String(c ?? "").trim().toLowerCase() === "weeks out")) {
      weekStarts.push(i);
    }
  }

  const weeks = weekStarts.map((start, wi) => {
    const end = wi + 1 < weekStarts.length ? weekStarts[wi + 1] : values.length;
    const dayMap = new Map<string, number>();

    for (let i = start; i < end; i++) {
      const row = values[i] as any[];
      if (!row) continue;
      const col3 = String(row[3] ?? "").trim().toUpperCase();

      const matchedDay = DAY_NAMES.find((d) => col3.startsWith(d.slice(0, 3)));
      if (matchedDay && !dayMap.has(col3)) {
        dayMap.set(col3, 0);
      }

      const movement = String(row[4] ?? "").trim();
      const reps = typeof row[7] === "number" ? row[7] : 0;
      if (movement && movement.length >= 2 && reps > 0 &&
          !/^(sleep|stress|nutrition|recovery|strength|feedback|notes|day|movement|tempo)/i.test(movement)) {
        const lastDay = [...dayMap.keys()].pop();
        if (lastDay) dayMap.set(lastDay, (dayMap.get(lastDay) ?? 0) + 1);
      }
    }

    return {
      weekIndex: wi,
      days: [...dayMap.entries()].map(([dayLabel, count]) => ({
        dayLabel: dayLabel.trim(),
        exerciseCount: count,
        weekIndex: wi,
      })),
    };
  });

  return NextResponse.json({ weeks });
}

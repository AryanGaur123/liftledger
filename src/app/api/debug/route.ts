import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SKIP_SHEETS_EXACT = /^(notes|rpe chart)/i;
const SKIP_SHEETS_CONTAINS = /attempts/i;

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { fileId } = await req.json();

  // Step 1: get sheet list
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const allSheets: string[] = (meta.sheets ?? []).map((s: any) => s.properties?.title).filter(Boolean);
  const blockSheets = allSheets.filter(
    (n: string) => !SKIP_SHEETS_EXACT.test(n) && !SKIP_SHEETS_CONTAINS.test(n)
  );

  // Step 2: detect template using first blockSheet
  let isCustomTemplate = false;
  let firstSheetSample: unknown[][] = [];
  if (blockSheets.length > 0) {
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(blockSheets[0])}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const d = await r.json();
    firstSheetSample = (d.values ?? []).slice(0, 15);
    for (let i = 0; i < Math.min(20, firstSheetSample.length); i++) {
      const row = firstSheetSample[i] as unknown[];
      if (row?.some((c) => String(c ?? "").trim().toLowerCase() === "weeks out")) { isCustomTemplate = true; break; }
      if (String(row?.[3] ?? "").trim().toLowerCase() === "day" &&
          String(row?.[4] ?? "").trim().toLowerCase() === "movement") { isCustomTemplate = true; break; }
    }
  }

  // Step 3: batchGet all sheets and count parsed rows
  const rangeParams = blockSheets.map((n) => `ranges=${encodeURIComponent(n)}`).join("&");
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${rangeParams}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;
  const batchRes = await fetch(batchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const batchData = await batchRes.json();
  const valueRanges: any[] = batchData.valueRanges ?? [];

  const sheetStats = blockSheets.map((name, i) => {
    const values: unknown[][] = valueRanges[i]?.values ?? [];
    let weeksOutCount = 0;
    let exerciseCount = 0;
    let hasColHeader = false;
    let firstWeeksOutSerial: unknown = null;

    for (const row of values) {
      const r = row as any[];
      const woIdx = r?.findIndex((c: any) => String(c ?? "").trim().toLowerCase() === "weeks out");
      if (woIdx >= 0) {
        weeksOutCount++;
        if (firstWeeksOutSerial === null) firstWeeksOutSerial = r[woIdx + 2];
      }
      if (String(r?.[3] ?? "").trim().toLowerCase() === "day" &&
          String(r?.[4] ?? "").trim().toLowerCase() === "movement") hasColHeader = true;
      const mv = String(r?.[4] ?? "").trim();
      const reps = r?.[7];
      if (mv && mv.length >= 2 && reps && !isNaN(Number(reps)) && Number(reps) > 0) exerciseCount++;
    }

    return {
      name,
      totalRows: values.length,
      weeksOutHeaders: weeksOutCount,
      hasColHeader,
      exerciseRows: exerciseCount,
      firstWeeksOutSerial,
      firstWeeksOutSerialType: typeof firstWeeksOutSerial,
      rangeReturnedByApi: valueRanges[i]?.range ?? "MISSING",
    };
  });

  return NextResponse.json({
    allSheets,
    blockSheets,
    isCustomTemplate,
    firstSheetSample,
    batchStatus: batchRes.status,
    sheetStats,
    valueRangesCount: valueRanges.length,
  });
}

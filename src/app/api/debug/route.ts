import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseXlsxBuffer } from "@/lib/parser";

const SKIP_EXACT = /^(notes|rpe chart)/i;
const SKIP_CONTAINS = /attempts/i;

function detectCustomTemplate(values: unknown[][]): boolean {
  for (let i = 0; i < Math.min(20, values.length); i++) {
    const row = values[i] as unknown[];
    if (!row) continue;
    if (row.some((c) => String(c ?? "").trim().toLowerCase() === "weeks out")) return true;
    if (
      String(row[3] ?? "").trim().toLowerCase() === "day" &&
      String(row[4] ?? "").trim().toLowerCase() === "movement"
    ) return true;
  }
  return false;
}

async function fetchSheetValues(fileId: string, title: string, accessToken: string) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(title)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { ok: false, status: res.status, values: [] };
  const d = await res.json();
  return { ok: true, status: res.status, values: d.values ?? [] };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { fileId, mimeType } = await req.json();

  if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

  const result: any = { fileId, mimeType, path: null };

  // ── XLSX / XLS path ───────────────────────────────────────────────────────
  if (mimeType !== "application/vnd.google-apps.spreadsheet") {
    result.path = "xlsx-download";
    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    result.downloadStatus = dlRes.status;
    if (!dlRes.ok) return NextResponse.json(result);

    const buffer = Buffer.from(await dlRes.arrayBuffer());
    const sheetData: any = parseXlsxBuffer(buffer);

    if (Array.isArray(sheetData) && sheetData.length > 0 && "movement" in sheetData[0]) {
      // FlatRow[] — custom template
      result.detectedAs = "custom-template-flatrows";
      const blockNames = [...new Set(sheetData.map((r: any) => r.blockName).filter(Boolean))];
      result.blockNames = blockNames;
      result.totalRows = sheetData.length;
      result.rowsPerBlock = Object.fromEntries(
        blockNames.map((n) => [n, sheetData.filter((r: any) => r.blockName === n).length])
      );
    } else {
      result.detectedAs = "generic-sheetdata";
      result.headers = sheetData.headers;
      result.totalRows = sheetData.rows?.length ?? 0;
    }
    return NextResponse.json(result);
  }

  // ── Google Sheets (native) path ───────────────────────────────────────────
  result.path = "google-sheets-api";

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  result.metaStatus = metaRes.status;
  if (!metaRes.ok) {
    result.metaError = await metaRes.text();
    return NextResponse.json(result);
  }

  const meta = await metaRes.json();
  const allSheets: string[] = (meta.sheets ?? []).map((s: any) => s.properties?.title).filter(Boolean);
  const blockSheets = allSheets.filter((n) => !SKIP_EXACT.test(n) && !SKIP_CONTAINS.test(n));
  result.allSheets = allSheets;
  result.blockSheets = blockSheets;

  if (blockSheets.length === 0) return NextResponse.json(result);

  // Detect template from first block sheet
  const firstFetch = await fetchSheetValues(fileId, blockSheets[0], accessToken);
  result.firstSheetStatus = firstFetch.status;
  result.isCustomTemplate = detectCustomTemplate(firstFetch.values);

  // batchGet all
  const rangeParams = blockSheets.map((n) => `ranges=${encodeURIComponent(n)}`).join("&");
  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchGet?${rangeParams}&majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  result.batchStatus = batchRes.status;
  const batchData = await batchRes.json();
  const valueRanges: any[] = batchData.valueRanges ?? [];
  result.valueRangesReturned = valueRanges.length;

  result.sheetStats = blockSheets.map((name, i) => {
    const values: unknown[][] = valueRanges[i]?.values ?? [];
    let weeksOut = 0, exercises = 0;
    for (const row of values) {
      const r = row as any[];
      if (r?.some((c: any) => String(c ?? "").trim().toLowerCase() === "weeks out")) weeksOut++;
      const mv = String(r?.[4] ?? "").trim();
      const reps = r?.[7];
      if (mv && mv.length >= 2 && reps && !isNaN(Number(reps)) && Number(reps) > 0) exercises++;
    }
    return { name, totalRows: values.length, weeksOutHeaders: weeksOut, exerciseRows: exercises, apiRange: valueRanges[i]?.range ?? "MISSING" };
  });

  return NextResponse.json(result);
}

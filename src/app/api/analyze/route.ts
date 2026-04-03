import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseGoogleSheetsValues, parseXlsxBuffer } from "@/lib/parser";
import { analyzeTrainingData } from "@/lib/analytics";

const SKIP_SHEETS = /^(notes|rpe chart|attempts)/i;

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { fileId, mimeType } = await req.json();

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  try {
    let sheetData;

    if (mimeType === "application/vnd.google-apps.spreadsheet") {
      // Native Google Sheet — fetch metadata for all sheets
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaRes.ok) {
        const body = await metaRes.json().catch(() => ({}));
        const msg = body?.error?.message || `HTTP ${metaRes.status}`;
        return NextResponse.json(
          { error: `Failed to read spreadsheet metadata: ${msg}` },
          { status: metaRes.status }
        );
      }

      const meta = await metaRes.json();
      const allSheets = (meta.sheets ?? []).map((s: any) => s.properties?.title).filter(Boolean);
      const blockSheets = allSheets.filter((n: string) => !SKIP_SHEETS.test(n));

      if (blockSheets.length === 0) {
        return NextResponse.json({ error: "No training data sheets found" }, { status: 400 });
      }

      // Fetch first sheet to detect format
      const firstValues = await fetchSheetValues(fileId, blockSheets[0], accessToken);
      const isCustomTemplate = detectCustomTemplate(firstValues);

      if (isCustomTemplate) {
        // Custom Aryan-template: fetch ALL block sheets and combine
        const { parseGoogleSheetsValues: parse } = await import("@/lib/parser");
        const { analyzeTrainingData: analyze } = await import("@/lib/analytics");

        // Import the internal parser directly
        const { parseAllGoogleSheetBlocks } = await import("@/lib/parser-internal");
        const allRows = await parseAllGoogleSheetBlocks(fileId, blockSheets, accessToken);

        if (allRows.length === 0) {
          return NextResponse.json(
            { error: "No training sets found. Check that your spreadsheet has exercises with sets, reps, and load filled in." },
            { status: 400 }
          );
        }

        sheetData = allRows;
      } else {
        // Generic flat table — find best sheet
        let bestData = null;
        let bestScore = -1;

        for (const title of blockSheets) {
          const values = await fetchSheetValues(fileId, title, accessToken);
          if (values.length < 2) continue;
          const { parseGoogleSheetsValues: parse } = await import("@/lib/parser");
          const parsed = parse(values, title);
          const score = (parsed.headers.length > 0 ? 1 : 0) + parsed.rows.length;
          if (score > bestScore) {
            bestScore = score;
            bestData = parsed;
          }
        }

        if (!bestData || bestData.rows.length === 0) {
          return NextResponse.json(
            { error: "No training data found. Ensure the spreadsheet has Exercise, Reps, and Weight columns." },
            { status: 400 }
          );
        }
        sheetData = bestData;
      }
    } else {
      // XLSX/XLS file — download and parse
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!downloadRes.ok) {
        return NextResponse.json(
          { error: `Failed to download file (${downloadRes.status})` },
          { status: downloadRes.status }
        );
      }

      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      sheetData = parseXlsxBuffer(buffer);
    }

    // sheetData is either SheetData or FlatRow[] from internal parser
    let headers: string[];
    let rows: unknown[][];
    let sheetName: string;

    if (Array.isArray(sheetData) && sheetData.length > 0 && "movement" in (sheetData[0] as any)) {
      // FlatRow[] from internal parser
      headers = ["date", "exercise", "sets", "reps", "weight", "rpe"];
      rows = (sheetData as any[]).map((r) => {
        // Use a plain array but attach blockName as a hidden property
        // so analytics.ts can read it for sheet-based block detection
        const arr: any[] = [
          r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          r.movement,
          r.sets,
          r.reps,
          r.loadKg,
          r.rpe,
        ];
        if (r.blockName) (arr as any).__blockName = r.blockName;
        return arr;
      });
      sheetName = "All Blocks";
    } else {
      const sd = sheetData as any;
      headers = sd.headers;
      rows = sd.rows;
      sheetName = sd.sheetName;
    }

    const result = analyzeTrainingData(rows, headers);

    const serializeDate = (d: unknown) => d instanceof Date ? d.toISOString() : d;
    const serializeSets = (sets: any[]) => sets.map((s) => ({ ...s, date: serializeDate(s.date) }));
    const serializeMetrics = (metrics: any[]) => metrics.map((m) => ({ ...m, weekStart: serializeDate(m.weekStart) }));

    // Serialize blockMetrics
    const serializedBlockMetrics: Record<string, any> = {};
    for (const [blockName, bm] of Object.entries(result.blockMetrics)) {
      serializedBlockMetrics[blockName] = {
        weeklyMetrics: serializeMetrics(bm.weeklyMetrics),
        liftSummary: bm.liftSummary,
        allLifts: bm.allLifts,
        allWeeks: bm.allWeeks,
        parsedSets: serializeSets(bm.parsedSets),
      };
    }

    return NextResponse.json({
      ...result,
      sheetName,
      headerDetected: headers,
      rowCount: rows.length,
      parsedSets: serializeSets(result.parsedSets),
      blocks: result.blocks.map((b) => ({
        ...b,
        startDate: serializeDate(b.startDate),
        endDate: serializeDate(b.endDate),
      })),
      latestBlock: {
        ...result.latestBlock,
        startDate: serializeDate(result.latestBlock.startDate),
        endDate: serializeDate(result.latestBlock.endDate),
      },
      weeklyMetrics: serializeMetrics(result.weeklyMetrics),
      blockMetrics: serializedBlockMetrics,
    });
  } catch (err: any) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to analyze spreadsheet" },
      { status: 500 }
    );
  }
}

async function fetchSheetValues(
  fileId: string,
  title: string,
  accessToken: string
): Promise<unknown[][]> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(title)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.values ?? [];
}

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

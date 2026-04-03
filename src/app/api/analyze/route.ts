import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseGoogleSheetsValues, parseXlsxBuffer } from "@/lib/parser";
import { analyzeTrainingData } from "@/lib/analytics";

// Skip sheets that are clearly not training blocks
const SKIP_SHEETS = /^(notes|rpe chart)/i;
const SKIP_SHEETS_CONTAINS = /attempts/i;

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
      const blockSheets = allSheets.filter(
        (n: string) => !SKIP_SHEETS.test(n) && !SKIP_SHEETS_CONTAINS.test(n)
      );

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
        // Generic flat table — score all sheets, combine if multiple look like training data
        const { parseGoogleSheetsValues: parse } = await import("@/lib/parser");
        const { detectColumns } = await import("@/lib/analytics");

        const scoredSheets: { title: string; parsed: any; score: number }[] = [];
        for (const title of blockSheets) {
          const values = await fetchSheetValues(fileId, title, accessToken);
          if (values.length < 2) continue;
          const parsed = parse(values, title);
          if (!parsed.headers.length || !parsed.rows.length) continue;
          const cols = detectColumns(parsed.headers);
          // Score: needs exercise + at least one of reps/weight
          const score = (cols.exercise >= 0 ? 3 : 0) + (cols.reps >= 0 ? 2 : 0) + (cols.weight >= 0 ? 2 : 0) + (cols.date >= 0 ? 1 : 0);
          if (score >= 3) scoredSheets.push({ title, parsed, score });
        }

        if (scoredSheets.length === 0) {
          return NextResponse.json(
            { error: "No training data found. Ensure the spreadsheet has Exercise, Reps, and Weight columns." },
            { status: 400 }
          );
        }

        if (scoredSheets.length > 1) {
          // Multiple training sheets — combine as FlatRows with blockName tags
          const { parseGenericGoogleSheetsFlatRows } = await import("@/lib/parser-internal");
          const allRows: any[] = [];
          for (const { title, parsed } of scoredSheets) {
            const flatRows = parseGenericGoogleSheetsFlatRows(parsed.rows, parsed.headers, title);
            for (const r of flatRows) r.blockName = title;
            allRows.push(...flatRows);
          }
          allRows.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
          sheetData = allRows;
        } else {
          sheetData = scoredSheets[0].parsed;
        }
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
      // Detect the dominant unit across all rows (if any sheet is lbs, surface that)
      const flatRows = sheetData as any[];
      const hasLbs = flatRows.some((r) => r.loadUnit === "lbs");
      const dominantUnit: "lbs" | "kg" = hasLbs ? "lbs" : "kg";

      headers = ["date", "exercise", "sets", "reps", "weight", "rpe"];
      rows = flatRows.map((r) => {
        // Pass weights through as-is — no conversion. The unit toggle is purely cosmetic.
        const arr: any[] = [
          r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
          r.movement,
          r.sets,
          r.reps,
          r.loadKg, // raw value, unit is whatever the sheet uses
          r.rpe,
        ];
        if (r.blockName) (arr as any).__blockName = r.blockName;
        return arr;
      });
      sheetName = "All Blocks";
      // Stash dominant unit so it surfaces in the response
      (rows as any).__weightUnit = dominantUnit;
    } else {
      const sd = sheetData as any;
      headers = sd.headers;
      rows = sd.rows;
      sheetName = sd.sheetName;
    }

    // Extract weight unit stashed on the rows array (lbs or kg)
    const weightUnit: "lbs" | "kg" = (rows as any).__weightUnit ?? "lbs";

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
      weightUnit,
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
    // Surface rate limit errors clearly
    if (err.name === "RateLimitError" || err.message?.includes("rate limit") || err.message?.includes("429")) {
      return NextResponse.json(
        { error: `Google API rate limit reached. Please wait a moment and try again.` },
        { status: 429 }
      );
    }
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
  if (res.status === 429) {
    const { RateLimitError } = await import("@/lib/parser-internal");
    throw new RateLimitError();
  }
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

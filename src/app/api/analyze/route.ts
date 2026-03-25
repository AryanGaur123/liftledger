import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { parseGoogleSheetsValues, parseXlsxBuffer } from "@/lib/parser";
import { analyzeTrainingData } from "@/lib/analytics";

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

    if (
      mimeType === "application/vnd.google-apps.spreadsheet"
    ) {
      // Native Google Sheet: use Sheets API
      // First get all sheet names
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!metaRes.ok) {
        const text = await metaRes.text();
        console.error("Sheets meta error:", text);
        return NextResponse.json(
          { error: "Failed to read spreadsheet metadata" },
          { status: metaRes.status }
        );
      }

      const meta = await metaRes.json();
      const sheets = meta.sheets || [];

      // Try each sheet, pick the one with best data
      let bestData = null;
      let bestScore = -1;

      for (const sheet of sheets) {
        const title = sheet.properties?.title;
        if (!title) continue;

        const valuesRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(title)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!valuesRes.ok) continue;

        const valuesData = await valuesRes.json();
        const values = valuesData.values || [];

        if (values.length < 2) continue;

        const parsed = parseGoogleSheetsValues(values, title);
        const score =
          (parsed.headers.length > 0 ? 1 : 0) + parsed.rows.length;

        if (score > bestScore) {
          bestScore = score;
          bestData = parsed;
        }
      }

      if (!bestData || bestData.rows.length === 0) {
        return NextResponse.json(
          { error: "No training data found in this spreadsheet. Make sure it has columns for Exercise, Reps, and Weight." },
          { status: 400 }
        );
      }

      sheetData = bestData;
    } else {
      // XLSX/XLS file: download and parse
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!downloadRes.ok) {
        return NextResponse.json(
          { error: "Failed to download file" },
          { status: downloadRes.status }
        );
      }

      const buffer = Buffer.from(await downloadRes.arrayBuffer());
      sheetData = parseXlsxBuffer(buffer);
    }

    // Run analytics
    const result = analyzeTrainingData(sheetData.rows, sheetData.headers);

    return NextResponse.json({
      ...result,
      sheetName: sheetData.sheetName,
      headerDetected: sheetData.headers,
      rowCount: sheetData.rows.length,
      // Serialize dates
      parsedSets: result.parsedSets.map((s) => ({
        ...s,
        date: s.date.toISOString(),
      })),
      blocks: result.blocks.map((b) => ({
        ...b,
        startDate: b.startDate.toISOString(),
        endDate: b.endDate.toISOString(),
      })),
      latestBlock: {
        ...result.latestBlock,
        startDate: result.latestBlock.startDate.toISOString(),
        endDate: result.latestBlock.endDate.toISOString(),
      },
      weeklyMetrics: result.weeklyMetrics.map((m) => ({
        ...m,
        weekStart: m.weekStart.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to analyze spreadsheet" },
      { status: 500 }
    );
  }
}

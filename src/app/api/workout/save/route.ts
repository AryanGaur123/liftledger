import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * POST /api/workout/save
 * Writes exercise RPE, weight, and feedback values back to the sheet.
 *
 * Body: { fileId, sheetName, updates: Array<{ row, col, value }> }
 * col is 0-indexed column number (e.g. K=10, I=8, N=13)
 */

function colToLetter(col: number): string {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { fileId, sheetName, updates } = await req.json();

  if (!fileId || !sheetName || !updates || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json(
      { error: "fileId, sheetName, and updates array are required" },
      { status: 400 }
    );
  }

  try {
    // Build batch value ranges — wrap sheet name in single quotes
    // CRITICAL: prevents names like B1, B8 being interpreted as cell refs
    const safeSheetName = "'" + sheetName.replace(/'/g, "''") + "'";

    const valueRanges = updates.map(
      (u: { row: number; col: number; value: number | string }) => ({
        range: `${safeSheetName}!${colToLetter(u.col)}${u.row}`,
        values: [[u.value]],
      })
    );

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: valueRanges,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `Sheets API error: ${res.status}`;
      console.error("Sheets batchUpdate error:", msg, body);
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json({
      success: true,
      updatedCells: result.totalUpdatedCells ?? updates.length,
    });
  } catch (err: any) {
    console.error("Workout save error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to save workout data" },
      { status: 500 }
    );
  }
}

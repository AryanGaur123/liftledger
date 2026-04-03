import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const { fileId } = await req.json();

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const firstSheet = meta.sheets?.[0]?.properties?.title;

  // Try UNFORMATTED_VALUE to see raw numbers
  const unformattedRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(firstSheet)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const unformatted = await unformattedRes.json();

  // Try FORMATTED_VALUE to see what user sees
  const formattedRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(firstSheet)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const formatted = await formattedRes.json();

  const ufRows = unformatted.values || [];
  const fRows = formatted.values || [];

  return NextResponse.json({
    sheetName: firstSheet,
    allSheets: meta.sheets?.map((s: any) => s.properties?.title),
    headers: fRows[0] || [],
    // First 5 data rows: both raw and formatted so we can see date format
    sampleUnformatted: ufRows.slice(1, 6),
    sampleFormatted: fRows.slice(1, 6),
    totalRows: ufRows.length,
  });
}

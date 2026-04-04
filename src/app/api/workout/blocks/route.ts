import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SKIP_EXACT = /^(notes|rpe chart)/i;
const SKIP_CONTAINS = /attempts/i;

/**
 * GET /api/workout/blocks?fileId=...
 *
 * Returns the list of training block sheet names.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    return NextResponse.json({ error: `Sheets API: ${metaRes.status}` }, { status: metaRes.status });
  }

  const meta = await metaRes.json();
  const allSheets: string[] = (meta.sheets ?? [])
    .map((s: any) => s.properties?.title)
    .filter(Boolean);

  const blockSheets = allSheets.filter(
    (n: string) => !SKIP_EXACT.test(n) && !SKIP_CONTAINS.test(n)
  );

  return NextResponse.json({ blockSheets });
}

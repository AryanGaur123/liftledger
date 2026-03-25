import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;

  try {
    // Search for spreadsheet files in Drive
    const query = encodeURIComponent(
      "mimeType='application/vnd.google-apps.spreadsheet' or " +
      "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or " +
      "mimeType='application/vnd.ms-excel'"
    );
    
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,mimeType,modifiedTime,iconLink)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Drive API error:", text);
      return NextResponse.json(
        { error: "Failed to fetch Drive files" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data.files || []);
  } catch (err) {
    console.error("Drive API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

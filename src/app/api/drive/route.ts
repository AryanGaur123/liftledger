import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated — please sign in" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;

  if (!accessToken) {
    const sessionError = (session as any).error;
    console.error("No access token in session. Error:", sessionError, "Session:", JSON.stringify(session));
    return NextResponse.json(
      {
        error: sessionError === "RefreshAccessTokenError"
          ? "Your session expired and could not be refreshed. Please sign out and sign in again."
          : "No Drive access token in session. Please sign out and sign in again to re-grant Drive permissions.",
      },
      { status: 401 }
    );
  }

  try {
    // Search for spreadsheet files in Drive
    const query = encodeURIComponent(
      "mimeType='application/vnd.google-apps.spreadsheet' or " +
      "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or " +
      "mimeType='application/vnd.ms-excel'"
    );

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime+desc&pageSize=50&fields=files(id,name,mimeType,modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ message: "unknown" }));
      const msg = errorBody?.error?.message || JSON.stringify(errorBody);
      console.error("Drive API error:", res.status, msg);

      if (res.status === 403) {
        return NextResponse.json(
          {
            error: `Google Drive access denied (403). Make sure the Google Drive API is enabled in your Google Cloud Console. Details: ${msg}`,
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Drive API error (${res.status}): ${msg}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data.files || []);
  } catch (err: any) {
    console.error("Drive API error:", err);
    return NextResponse.json(
      { error: `Internal error: ${err.message}` },
      { status: 500 }
    );
  }
}

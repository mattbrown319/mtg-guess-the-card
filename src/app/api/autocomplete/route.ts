import { NextRequest, NextResponse } from "next/server";
import { searchCardNames } from "@/lib/cards";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json({ names: [] });
    }

    const names = await searchCardNames(q, 10);
    return NextResponse.json({ names });
  } catch (err) {
    console.error("Autocomplete error:", err);
    return NextResponse.json(
      { error: String(err), stack: err instanceof Error ? err.stack : undefined },
      { status: 500 }
    );
  }
}

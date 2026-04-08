import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.startsWith("cf-") || key.startsWith("x-") || key.includes("country") || key.includes("geo") || key.includes("region")) {
      headers[key] = value;
    }
  });
  return NextResponse.json({ headers });
}

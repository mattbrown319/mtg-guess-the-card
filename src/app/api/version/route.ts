import { NextResponse } from "next/server";
import { ENGINE_VERSION } from "@/lib/version";

export async function GET() {
  return NextResponse.json({ engineVersion: ENGINE_VERSION });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) {
    return NextResponse.json({ cards: [] });
  }

  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT id, name, type_line, set_name, image_uri_normal FROM cards WHERE name LIKE ? AND is_iconic = 1 AND image_uri_normal IS NOT NULL ORDER BY popularity_score ASC NULLS LAST LIMIT 10",
    args: [`%${q}%`],
  });

  return NextResponse.json({
    cards: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      typeLine: r.type_line,
      setName: r.set_name,
      imageUrl: r.image_uri_normal,
    })),
  });
}

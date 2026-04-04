import { getDb } from "./db";
import type { Card } from "@/types";
import type { Row } from "@libsql/client";

function rowToCard(row: Row): Card {
  return {
    id: row.id as string,
    oracle_id: row.oracle_id as string,
    name: row.name as string,
    layout: row.layout as string,
    mana_cost: row.mana_cost as string | null,
    cmc: row.cmc as number,
    type_line: row.type_line as string,
    oracle_text: row.oracle_text as string | null,
    colors: JSON.parse(row.colors as string),
    color_identity: JSON.parse(row.color_identity as string),
    keywords: JSON.parse(row.keywords as string),
    power: row.power as string | null,
    toughness: row.toughness as string | null,
    loyalty: row.loyalty as string | null,
    rarity: row.rarity as string,
    set_code: row.set_code as string,
    set_name: row.set_name as string,
    released_at: row.released_at as string,
    artist: row.artist as string,
    edhrec_rank: row.edhrec_rank as number | null,
    flavor_text: row.flavor_text as string | null,
    image_uri_normal: row.image_uri_normal as string | null,
    image_uri_art_crop: row.image_uri_art_crop as string | null,
    legalities: JSON.parse(row.legalities as string),
    card_faces: row.card_faces ? JSON.parse(row.card_faces as string) : null,
    produced_mana: JSON.parse((row.produced_mana as string) || "[]"),
    all_sets: row.all_sets ? JSON.parse(row.all_sets as string) : null,
    all_years: row.all_years ? JSON.parse(row.all_years as string) : null,
  };
}

export interface CardFilters {
  format?: string;
  popularityTier?: string;
  cardType?: string;
  excludeNames?: string[];
}

// Cache iconic card IDs in memory to avoid ORDER BY RANDOM() on Turso
let iconicCardIds: string[] | null = null;

async function getIconicCardIds(): Promise<string[]> {
  if (iconicCardIds) return iconicCardIds;
  const db = await getDb();
  const result = await db.execute("SELECT id FROM cards WHERE is_iconic = 1 AND image_uri_normal IS NOT NULL");
  iconicCardIds = result.rows.map(r => r.id as string);
  console.log(`[CACHE] Loaded ${iconicCardIds.length} iconic card IDs`);
  return iconicCardIds;
}

export async function getRandomCard(filters: CardFilters): Promise<Card | null> {
  // Fast path for iconic tier: pick from cached IDs
  if (filters.popularityTier === "popular" && !filters.format && !filters.cardType) {
    const ids = await getIconicCardIds();
    const excludeSet = new Set(filters.excludeNames || []);
    // Pick random ID, retry if excluded (by name, checked after fetch)
    for (let attempt = 0; attempt < 10; attempt++) {
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      const card = await getCardById(randomId);
      if (card && !excludeSet.has(card.name)) return card;
    }
    // Fallback: just return any card
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    return getCardById(randomId);
  }

  const db = await getDb();
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  conditions.push("image_uri_normal IS NOT NULL");

  if (filters.format) {
    conditions.push(
      `json_extract(legalities, '$.' || ?) IN ('legal', 'restricted')`
    );
    args.push(filters.format);
  }

  if (filters.popularityTier) {
    switch (filters.popularityTier) {
      case "popular":
        conditions.push("is_iconic = 1");
        break;
      case "well-known":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 500");
        break;
      case "medium":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 2000");
        break;
      case "obscure":
        conditions.push("popularity_score IS NOT NULL AND popularity_score > 2000");
        break;
    }
  }

  if (filters.cardType) {
    conditions.push("type_line LIKE ?");
    args.push(`%${filters.cardType}%`);
  }

  if (filters.excludeNames && filters.excludeNames.length > 0) {
    const placeholders = filters.excludeNames.map(() => "?").join(",");
    conditions.push(`name NOT IN (${placeholders})`);
    args.push(...filters.excludeNames);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM cards ${where} ORDER BY RANDOM() LIMIT 1`;

  const result = await db.execute({ sql, args });
  return result.rows.length > 0 ? rowToCard(result.rows[0]) : null;
}

export async function getCardById(id: string): Promise<Card | null> {
  const db = await getDb();
  const result = await db.execute({ sql: "SELECT * FROM cards WHERE id = ?", args: [id] });
  return result.rows.length > 0 ? rowToCard(result.rows[0]) : null;
}

export async function searchCardNames(query: string, limit: number = 10): Promise<string[]> {
  if (!query || query.length < 2) return [];
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT DISTINCT name FROM cards WHERE name LIKE ? ORDER BY popularity_score ASC NULLS LAST LIMIT ?",
    args: [`%${query}%`, limit],
  });
  return result.rows.map((r) => r.name as string);
}

export async function getCardCount(filters: CardFilters): Promise<number> {
  const db = await getDb();
  const conditions: string[] = ["image_uri_normal IS NOT NULL"];
  const args: (string | number)[] = [];

  if (filters.format) {
    conditions.push(
      `json_extract(legalities, '$.' || ?) IN ('legal', 'restricted')`
    );
    args.push(filters.format);
  }

  if (filters.popularityTier) {
    switch (filters.popularityTier) {
      case "popular":
        conditions.push("is_iconic = 1");
        break;
      case "well-known":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 500");
        break;
      case "medium":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 2000");
        break;
      case "obscure":
        conditions.push("popularity_score IS NOT NULL AND popularity_score > 2000");
        break;
    }
  }

  if (filters.cardType) {
    conditions.push("type_line LIKE ?");
    args.push(`%${filters.cardType}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM cards ${where}`,
    args,
  });
  return result.rows[0].count as number;
}

export async function getAllCardNames(filters: CardFilters): Promise<string[]> {
  const db = await getDb();
  const conditions: string[] = ["image_uri_normal IS NOT NULL"];
  const args: (string | number)[] = [];

  if (filters.format) {
    conditions.push(
      `json_extract(legalities, '$.' || ?) IN ('legal', 'restricted')`
    );
    args.push(filters.format);
  }

  if (filters.popularityTier) {
    switch (filters.popularityTier) {
      case "popular":
        conditions.push("is_iconic = 1");
        break;
      case "well-known":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 500");
        break;
      case "medium":
        conditions.push("popularity_score IS NOT NULL AND popularity_score <= 2000");
        break;
      case "obscure":
        conditions.push("popularity_score IS NOT NULL AND popularity_score > 2000");
        break;
    }
  }

  if (filters.cardType) {
    conditions.push("type_line LIKE ?");
    args.push(`%${filters.cardType}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.execute({
    sql: `SELECT DISTINCT name FROM cards ${where} ORDER BY name`,
    args,
  });
  return result.rows.map((r) => r.name as string);
}

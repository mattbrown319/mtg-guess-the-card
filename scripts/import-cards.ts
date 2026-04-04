import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");
const BULK_DATA_URL = "https://api.scryfall.com/bulk-data";

const SKIP_LAYOUTS = new Set([
  "token",
  "double_faced_token",
  "emblem",
  "art_series",
  "planar",
  "scheme",
  "vanguard",
]);

async function getBulkDownloadUrl(type: string): Promise<string> {
  console.log(`Fetching bulk data manifest for ${type}...`);
  const res = await fetch(BULK_DATA_URL);
  const data = await res.json();
  const entry = data.data.find((d: { type: string }) => d.type === type);
  if (!entry) throw new Error(`Could not find ${type} bulk data`);
  console.log(`Found ${type}: ${entry.download_uri}`);
  return entry.download_uri;
}

async function downloadJson(url: string, label: string): Promise<unknown[]> {
  console.log(`Downloading ${label} (this may take a minute)...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const text = await res.text();
  console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(1)} MB`);
  return JSON.parse(text);
}

interface PrintingData {
  count: number;
  sets: Set<string>;
  years: Set<string>;
}

function countPrintings(defaultCards: unknown[]): Map<string, PrintingData> {
  console.log("Counting printings and collecting sets per card...");
  const data = new Map<string, PrintingData>();
  for (const raw of defaultCards) {
    const card = raw as Record<string, unknown>;
    const oracleId = card.oracle_id as string;
    if (!oracleId) continue;
    if (card.lang !== "en") continue;
    if (card.digital === true) continue;

    if (!data.has(oracleId)) {
      data.set(oracleId, { count: 0, sets: new Set(), years: new Set() });
    }
    const d = data.get(oracleId)!;
    d.count++;
    const setName = card.set_name as string;
    if (setName) d.sets.add(setName);
    const releasedAt = card.released_at as string;
    if (releasedAt) d.years.add(releasedAt.slice(0, 4));
  }
  console.log(`Collected printing data for ${data.size} unique cards`);
  return data;
}

function createDatabase(): Database.Database {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log("Removed existing database");
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE cards (
      id TEXT PRIMARY KEY,
      oracle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      layout TEXT NOT NULL,
      mana_cost TEXT,
      cmc REAL NOT NULL,
      type_line TEXT NOT NULL,
      oracle_text TEXT,
      colors TEXT,
      color_identity TEXT,
      keywords TEXT,
      power TEXT,
      toughness TEXT,
      loyalty TEXT,
      rarity TEXT NOT NULL,
      set_code TEXT,
      set_name TEXT,
      released_at TEXT,
      artist TEXT,
      edhrec_rank INTEGER,
      penny_rank INTEGER,
      num_printings INTEGER DEFAULT 1,
      popularity_score REAL,
      all_sets TEXT,
      all_years TEXT,
      flavor_text TEXT,
      image_uri_normal TEXT,
      image_uri_art_crop TEXT,
      legalities TEXT,
      card_faces TEXT,
      produced_mana TEXT
    );

    CREATE INDEX idx_cards_name ON cards(name);
    CREATE INDEX idx_cards_edhrec_rank ON cards(edhrec_rank);
    CREATE INDEX idx_cards_popularity ON cards(popularity_score);
    CREATE INDEX idx_cards_cmc ON cards(cmc);
    CREATE INDEX idx_cards_rarity ON cards(rarity);
    CREATE INDEX idx_cards_type_line ON cards(type_line);
  `);

  console.log("Created database and indexes");
  return db;
}

function computePopularity(
  edhrecRank: number | null,
  pennyRank: number | null,
  numPrintings: number,
  rarity: string,
  legalities: Record<string, string>
): number {
  // Lower score = more popular/recognizable

  // Count bans/restrictions — a signal of historical significance
  const banCount = Object.values(legalities).filter(
    (s) => s === "banned" || s === "restricted"
  ).length;

  // For cards with NO rank data at all, use printings + bans to estimate
  // A card with 10+ printings and bans is almost certainly iconic
  const hasNoRanks = edhrecRank === null && pennyRank === null;
  let bestRank: number;

  if (hasNoRanks) {
    // Estimate rank from printings and bans
    // More printings + more bans = more famous
    // Black Lotus: 13 printings, banned everywhere → should score ~5
    const printingSignal = Math.max(1, 200 - numPrintings * 15);
    const banSignal = banCount > 0 ? 0.3 : 1.0;
    bestRank = printingSignal * banSignal;
  } else {
    const edhrec = edhrecRank ?? 99999;
    const penny = pennyRank ?? 99999;
    bestRank = Math.min(edhrec, penny);
  }

  // Printings bonus: more printings = more iconic
  const printingsBonus = Math.log2(Math.max(numPrintings, 1));

  // Rarity bonus: mythics/rares are more recognizable
  const rarityMultiplier =
    rarity === "mythic" || rarity === "bonus" ? 0.7
    : rarity === "rare" ? 0.85
    : 1.0;

  // Ban bonus: banned/restricted cards are more famous
  const banMultiplier = banCount >= 5 ? 0.5 : banCount >= 2 ? 0.7 : banCount >= 1 ? 0.85 : 1.0;

  const score = (bestRank / (1 + printingsBonus)) * rarityMultiplier * banMultiplier;

  return Math.round(score);
}

function importCards(
  db: Database.Database,
  cards: unknown[],
  printingCounts: Map<string, PrintingData>
): void {
  const insert = db.prepare(`
    INSERT INTO cards (
      id, oracle_id, name, layout, mana_cost, cmc, type_line, oracle_text,
      colors, color_identity, keywords, power, toughness, loyalty,
      rarity, set_code, set_name, released_at, artist, edhrec_rank,
      penny_rank, num_printings, popularity_score, all_sets, all_years,
      flavor_text, image_uri_normal, image_uri_art_crop, legalities,
      card_faces, produced_mana
    ) VALUES (
      @id, @oracle_id, @name, @layout, @mana_cost, @cmc, @type_line, @oracle_text,
      @colors, @color_identity, @keywords, @power, @toughness, @loyalty,
      @rarity, @set_code, @set_name, @released_at, @artist, @edhrec_rank,
      @penny_rank, @num_printings, @popularity_score, @all_sets, @all_years,
      @flavor_text, @image_uri_normal, @image_uri_art_crop, @legalities,
      @card_faces, @produced_mana
    )
  `);

  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  let imported = 0;
  let skipped = 0;
  const batch: Record<string, unknown>[] = [];

  for (const raw of cards) {
    const card = raw as Record<string, unknown>;

    if (SKIP_LAYOUTS.has(card.layout as string)) {
      skipped++;
      continue;
    }

    // Skip placeholder cards
    const cardName = card.name as string;
    if (cardName.includes("Substitute Card")) {
      skipped++;
      continue;
    }

    let imageNormal = null;
    let imageArtCrop = null;
    const imageUris = card.image_uris as Record<string, string> | undefined;
    const cardFaces = card.card_faces as Record<string, unknown>[] | undefined;

    if (imageUris) {
      imageNormal = imageUris.normal || null;
      imageArtCrop = imageUris.art_crop || null;
    } else if (cardFaces && cardFaces.length > 0) {
      const faceUris = cardFaces[0].image_uris as
        | Record<string, string>
        | undefined;
      if (faceUris) {
        imageNormal = faceUris.normal || null;
        imageArtCrop = faceUris.art_crop || null;
      }
    }

    let cardFacesJson = null;
    if (cardFaces && cardFaces.length > 0) {
      cardFacesJson = JSON.stringify(
        cardFaces.map((face) => ({
          name: face.name,
          mana_cost: face.mana_cost,
          type_line: face.type_line,
          oracle_text: face.oracle_text,
          colors: face.colors,
          power: face.power || null,
          toughness: face.toughness || null,
          loyalty: face.loyalty || null,
          image_uri_normal:
            (face.image_uris as Record<string, string> | undefined)?.normal ||
            null,
          image_uri_art_crop:
            (face.image_uris as Record<string, string> | undefined)?.art_crop ||
            null,
        }))
      );
    }

    const oracleId = card.oracle_id as string;
    const edhrecRank = (card.edhrec_rank as number) || null;
    const pennyRank = (card.penny_rank as number) || null;
    const printingData = printingCounts.get(oracleId);
    const numPrintings = printingData?.count || 1;
    const allSets = printingData ? JSON.stringify(Array.from(printingData.sets).sort()) : "[]";
    const allYears = printingData ? JSON.stringify(Array.from(printingData.years).sort()) : "[]";
    const rarity = card.rarity as string;
    const typeLine = card.type_line as string;
    const legalities = (card.legalities || {}) as Record<string, string>;

    // Basic lands get a fixed score — everyone knows them but they're boring to guess
    if (typeLine.includes("Basic Land")) {
      batch.push({
        id: card.id as string,
        oracle_id: oracleId,
        name: cardName,
        layout: card.layout as string,
        mana_cost: (card.mana_cost as string) || null,
        cmc: card.cmc as number,
        type_line: typeLine,
        oracle_text: (card.oracle_text as string) || null,
        colors: JSON.stringify(card.colors || []),
        color_identity: JSON.stringify(card.color_identity || []),
        keywords: JSON.stringify(card.keywords || []),
        power: (card.power as string) || null,
        toughness: (card.toughness as string) || null,
        loyalty: (card.loyalty as string) || null,
        rarity,
        set_code: (card.set as string) || null,
        set_name: (card.set_name as string) || null,
        released_at: (card.released_at as string) || null,
        artist: (card.artist as string) || null,
        edhrec_rank: edhrecRank,
        penny_rank: pennyRank,
        num_printings: numPrintings,
        popularity_score: 5000, // Known but boring to guess
        all_sets: allSets,
        all_years: allYears,
        flavor_text: (card.flavor_text as string) || null,
        image_uri_normal: imageNormal,
        image_uri_art_crop: imageArtCrop,
        legalities: JSON.stringify(legalities),
        card_faces: cardFacesJson,
        produced_mana: JSON.stringify(card.produced_mana || []),
      });
      if (batch.length >= 500) {
        insertMany(batch);
        imported += batch.length;
        batch.length = 0;
        process.stdout.write(`\rImported ${imported} cards...`);
      }
      continue;
    }

    const popularityScore = computePopularity(
      edhrecRank,
      pennyRank,
      numPrintings,
      rarity,
      legalities
    );

    batch.push({
      id: card.id as string,
      oracle_id: oracleId,
      name: card.name as string,
      layout: card.layout as string,
      mana_cost: (card.mana_cost as string) || null,
      cmc: card.cmc as number,
      type_line: card.type_line as string,
      oracle_text: (card.oracle_text as string) || null,
      colors: JSON.stringify(card.colors || []),
      color_identity: JSON.stringify(card.color_identity || []),
      keywords: JSON.stringify(card.keywords || []),
      power: (card.power as string) || null,
      toughness: (card.toughness as string) || null,
      loyalty: (card.loyalty as string) || null,
      rarity,
      set_code: (card.set as string) || null,
      set_name: (card.set_name as string) || null,
      released_at: (card.released_at as string) || null,
      artist: (card.artist as string) || null,
      edhrec_rank: edhrecRank,
      penny_rank: pennyRank,
      num_printings: numPrintings,
      popularity_score: popularityScore,
      all_sets: allSets,
      all_years: allYears,
      flavor_text: (card.flavor_text as string) || null,
      image_uri_normal: imageNormal,
      image_uri_art_crop: imageArtCrop,
      legalities: JSON.stringify(card.legalities || {}),
      card_faces: cardFacesJson,
      produced_mana: JSON.stringify(card.produced_mana || []),
    });

    if (batch.length >= 500) {
      insertMany(batch);
      imported += batch.length;
      batch.length = 0;
      process.stdout.write(`\rImported ${imported} cards...`);
    }
  }

  if (batch.length > 0) {
    insertMany(batch);
    imported += batch.length;
  }

  console.log(`\nDone! Imported ${imported} cards, skipped ${skipped}`);
}

async function main() {
  // Download oracle cards (unique cards) and default cards (all printings)
  const [oracleUrl, defaultUrl] = await Promise.all([
    getBulkDownloadUrl("oracle_cards"),
    getBulkDownloadUrl("default_cards"),
  ]);

  // Download both in parallel
  const [oracleCards, defaultCards] = await Promise.all([
    downloadJson(oracleUrl, "oracle cards"),
    downloadJson(defaultUrl, "default cards (all printings)"),
  ]);

  const printingCounts = countPrintings(defaultCards);

  const db = createDatabase();
  importCards(db, oracleCards, printingCounts);
  db.close();

  // Print stats
  const stats = new Database(DB_PATH);
  const count = stats.prepare("SELECT COUNT(*) as count FROM cards").get() as {
    count: number;
  };
  const withScore = stats
    .prepare(
      "SELECT COUNT(*) as count FROM cards WHERE popularity_score IS NOT NULL"
    )
    .get() as { count: number };

  console.log(`\nDatabase stats:`);
  console.log(`  Total cards: ${count.count}`);
  console.log(`  Cards with popularity score: ${withScore.count}`);

  console.log(`\n  Top 20 by popularity score (lower = more popular):`);
  const topCards = stats
    .prepare(
      `SELECT name, popularity_score, edhrec_rank, penny_rank, num_printings, rarity
       FROM cards WHERE popularity_score IS NOT NULL
       ORDER BY popularity_score ASC LIMIT 20`
    )
    .all() as {
    name: string;
    popularity_score: number;
    edhrec_rank: number | null;
    penny_rank: number | null;
    num_printings: number;
    rarity: string;
  }[];
  for (const card of topCards) {
    console.log(
      `    score=${card.popularity_score} | edh=${card.edhrec_rank ?? "—"} | penny=${card.penny_rank ?? "—"} | prints=${card.num_printings} | ${card.rarity} | ${card.name}`
    );
  }

  // Check some previously problematic cards
  console.log(`\n  Spot checks (should be well-known):`);
  const spotChecks = [
    "Tarmogoyf",
    "Delver of Secrets",
    "Monastery Swiftspear",
    "Lightning Bolt",
    "Counterspell",
    "Sol Ring",
    "Rhystic Study",
  ];
  for (const name of spotChecks) {
    const card = stats
      .prepare(
        "SELECT name, popularity_score, edhrec_rank, penny_rank, num_printings FROM cards WHERE name = ?"
      )
      .get(name) as {
      name: string;
      popularity_score: number;
      edhrec_rank: number | null;
      penny_rank: number | null;
      num_printings: number;
    } | undefined;
    if (card) {
      console.log(
        `    score=${card.popularity_score} | edh=${card.edhrec_rank ?? "—"} | penny=${card.penny_rank ?? "—"} | prints=${card.num_printings} | ${card.name}`
      );
    }
  }

  stats.close();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});

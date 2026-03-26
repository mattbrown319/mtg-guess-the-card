import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "data", "cards.db");

// Manually curated iconic cards that any experienced MTG player would recognize
const CURATED_ICONIC: Set<string> = new Set([
  // Power 9
  "Black Lotus", "Ancestral Recall", "Time Walk", "Mox Pearl", "Mox Sapphire",
  "Mox Jet", "Mox Ruby", "Mox Emerald", "Timetwister",

  // Classic iconic banned/restricted
  "Balance", "Channel", "Fastbond", "Library of Alexandria", "Necropotence",
  "Tinker", "Tolarian Academy", "Yawgmoth's Will", "Time Vault",
  "Contract from Below", "Demonic Attorney", "Darkpact",
  "Chaos Orb", "Falling Star", "Shahrazad",
  "Crusade", "Berserk",

  // Iconic competitive creatures
  "Tarmogoyf", "Dark Confidant", "Snapcaster Mage",
  "Delver of Secrets // Insectile Aberration", "Monastery Swiftspear",
  "Goblin Guide", "Wild Nacatl", "Vendilion Clique",
  "True-Name Nemesis", "Stoneforge Mystic",
  "Griselbrand", "Emrakul, the Aeons Torn", "Emrakul, the Promised End",
  "Thalia, Guardian of Thraben", "Mother of Runes",
  "Knight of the Reliquary", "Kitchen Finks", "Bloodbraid Elf",
  "Thragtusk", "Siege Rhino",
  "Bonecrusher Giant // Stomp", "Questing Beast",
  "Thought-Knot Seer", "Reality Smasher",
  "Murktide Regent", "Orcish Bowmasters", "Sheoldred, the Apocalypse",
  "Dragon's Rage Channeler", "Ledger Shredder",
  "Phyrexian Obliterator",
  "Hogaak, Arisen Necropolis", "Uro, Titan of Nature's Wrath",
  "Lurrus of the Dream-Den", "Ragavan, Nimble Pilferer",
  "Deathrite Shaman",
  "Serra Angel", "Shivan Dragon", "Hypnotic Specter",
  "Royal Assassin", "Sengir Vampire", "Mahamoti Djinn",
  "Lord of the Pit", "Force of Nature",
  "Air Elemental", "Nightmare",

  // Iconic non-competitive but universally known creatures
  "Storm Crow", "Colossal Dreadmaw",
  "Meandering Towershell",

  // Iconic instants (competitive)
  "Force of Negation", "Daze", "Mental Misstep",
  "Fatal Push", "Dismember", "Go for the Throat", "Snuff Out",
  "Lightning Helix", "Abrupt Decay", "Assassin's Trophy",
  "Hymn to Tourach", "Chain Lightning",
  "Gifts Ungiven", "Fact or Fiction",
  "Remand",
  "Collected Company", "Chord of Calling",
  "Entomb", "Reanimate",
  "Shock", "Incinerate",

  // Iconic sorceries (competitive)
  "Show and Tell", "Sneak Attack", "Natural Order",
  "Green Sun's Zenith", "Scapeshift",
  "Armageddon", "Jokulhaups",
  "Thoughtseize", "Inquisition of Kozilek",
  "Wheel of Fortune", "Timetwister",
  "Maelstrom Pulse", "Toxic Deluge",
  "Exhume", "Living End",
  "Splinter Twin",

  // Iconic enchantments (competitive)
  "Blood Moon", "Back to Basics", "Stasis",
  "Recurring Nightmare", "Opposition",
  "Bitterblossom", "Shark Typhoon",
  "Omniscience", "Dream Halls",
  "Rest in Peace", "Leyline of the Void",
  "Necropotence", "Yawgmoth's Bargain",
  "Animate Dead", "Necromancy",

  // Iconic artifacts (competitive)
  "Aether Vial", "Chalice of the Void", "Ensnaring Bridge",
  "Lion's Eye Diamond", "Mox Diamond", "Chrome Mox",
  "Crucible of Worlds", "Scroll Rack",
  "The Rack", "Black Vise",
  "Winter Orb", "Trinisphere", "Tangle Wire", "Smokestack",
  "Springleaf Drum", "Cranial Plating",
  "Isochron Scepter",
  "Grafdigger's Cage", "Relic of Progenitus",
  "Umezawa's Jitte", "Batterskull",
  "Sword of Fire and Ice", "Sword of Feast and Famine",

  // Iconic planeswalkers
  "Jace, the Mind Sculptor", "Jace, Vryn's Prodigy // Jace, Telepath Unbound",
  "Liliana of the Veil", "Liliana, the Last Hope",
  "Karn Liberated", "Karn, the Great Creator",
  "Ugin, the Spirit Dragon",
  "Teferi, Time Raveler", "Teferi, Hero of Dominaria",
  "Oko, Thief of Crowns",
  "Wrenn and Six",
  "Garruk Wildspeaker", "Chandra, Torch of Defiance",
  "Nissa, Who Shakes the World",
  "Elspeth, Sun's Champion", "Gideon, Ally of Zendikar",
  "Narset, Parter of Veils", "Dack Fayden",
  "Nicol Bolas, Dragon-God",

  // Classic lands everyone knows
  "Dark Depths", "Maze of Ith", "Karakas",
  "Gaea's Cradle", "Serra's Sanctum", "Tolarian Academy",
  "Wasteland", "Rishadan Port",
  "Mutavault", "Creeping Tar Pit",
  "Prismatic Vista",
  "Mishra's Factory",

  // Theros Gods
  "Thassa, God of the Sea", "Erebos, God of the Dead",
  "Purphoros, God of the Forge", "Nylea, God of the Hunt",
  "Heliod, Sun-Crowned",

  // Iconic "bad" cards that are famous for being bad
  "One with Nothing",
]);

function main() {
  const db = new Database(DB_PATH);

  // Add is_iconic column
  try {
    db.exec("ALTER TABLE cards ADD COLUMN is_iconic INTEGER DEFAULT 0");
  } catch {
    // Column already exists
    db.exec("UPDATE cards SET is_iconic = 0");
  }

  // Mark curated cards
  const markCurated = db.prepare("UPDATE cards SET is_iconic = 1 WHERE name = ?");
  let curatedCount = 0;
  for (const name of CURATED_ICONIC) {
    const result = markCurated.run(name);
    if (result.changes > 0) curatedCount++;
  }
  console.log(`Marked ${curatedCount} curated iconic cards`);

  // Also mark cards that are BOTH popular in EDHREC (top 500) AND have 8+ printings
  const autoResult = db.prepare(`
    UPDATE cards SET is_iconic = 1
    WHERE is_iconic = 0
    AND edhrec_rank IS NOT NULL AND edhrec_rank <= 500
    AND num_printings >= 8
    AND image_uri_normal IS NOT NULL
  `).run();
  console.log(`Auto-marked ${autoResult.changes} cards (EDHREC ≤500, 8+ printings)`);

  // Also mark cards that are BOTH popular in EDHREC (top 200) AND have 5+ printings
  const autoResult2 = db.prepare(`
    UPDATE cards SET is_iconic = 1
    WHERE is_iconic = 0
    AND edhrec_rank IS NOT NULL AND edhrec_rank <= 200
    AND num_printings >= 5
    AND image_uri_normal IS NOT NULL
  `).run();
  console.log(`Auto-marked ${autoResult2.changes} cards (EDHREC ≤200, 5+ printings)`);

  // Count total
  const total = db.prepare("SELECT COUNT(*) as count FROM cards WHERE is_iconic = 1").get() as { count: number };
  console.log(`\nTotal iconic cards: ${total.count}`);

  // Show some samples
  console.log("\nSample iconic cards:");
  const samples = db.prepare("SELECT name, edhrec_rank, penny_rank, num_printings FROM cards WHERE is_iconic = 1 ORDER BY RANDOM() LIMIT 20").all() as { name: string; edhrec_rank: number | null; penny_rank: number | null; num_printings: number }[];
  for (const s of samples) {
    console.log(`  ${s.name} (edh=${s.edhrec_rank ?? '—'}, penny=${s.penny_rank ?? '—'}, prints=${s.num_printings})`);
  }

  // Check for non-iconic cards that might be surprising
  console.log("\nCards NOT marked iconic that have EDHREC ≤100:");
  const missed = db.prepare(`
    SELECT name, edhrec_rank, num_printings
    FROM cards WHERE is_iconic = 0 AND edhrec_rank IS NOT NULL AND edhrec_rank <= 100
    AND image_uri_normal IS NOT NULL
    ORDER BY edhrec_rank LIMIT 20
  `).all() as { name: string; edhrec_rank: number; num_printings: number }[];
  for (const m of missed) {
    console.log(`  ${m.name} (edh=${m.edhrec_rank}, prints=${m.num_printings})`);
  }

  db.close();
}

main();

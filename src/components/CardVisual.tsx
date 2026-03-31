"use client";

import type { CardAttributes } from "@/types/beta";

interface CardVisualProps {
  attributes: CardAttributes;
  revealedName?: string;
  revealedArt?: string;
}

function getFrameColor(colors: string[] | null): string {
  if (!colors) return "from-gray-700 to-gray-800"; // Unknown
  if (colors.length === 0) return "from-gray-400 to-gray-500"; // Colorless
  if (colors.length > 1) return "from-amber-600 to-amber-700"; // Multicolor/gold
  switch (colors[0]) {
    case "W": return "from-amber-50 to-amber-100";
    case "U": return "from-blue-500 to-blue-700";
    case "B": return "from-gray-800 to-gray-900";
    case "R": return "from-red-600 to-red-800";
    case "G": return "from-green-600 to-green-800";
    default: return "from-gray-700 to-gray-800";
  }
}

function getTextColor(colors: string[] | null): string {
  if (!colors) return "text-gray-400";
  if (colors.length === 0) return "text-gray-800";
  if (colors.length > 1) return "text-amber-100";
  switch (colors[0]) {
    case "W": return "text-gray-800";
    case "U": return "text-blue-100";
    case "B": return "text-gray-300";
    case "R": return "text-red-100";
    case "G": return "text-green-100";
    default: return "text-gray-400";
  }
}

function getRarityColor(rarity: string | null): string {
  switch (rarity) {
    case "common": return "bg-gray-800";
    case "uncommon": return "bg-gray-400";
    case "rare": return "bg-amber-500";
    case "mythic": return "bg-orange-500";
    default: return "bg-gray-600";
  }
}

// MTG type ordering convention
const TYPE_ORDER = ["tribal", "legendary", "basic", "snow", "world",
  "artifact", "enchantment", "creature", "land", "planeswalker",
  "instant", "sorcery", "battle", "kindred"];

function buildTypeLine(attrs: CardAttributes): string {
  const parts: string[] = [];

  if (attrs.supertypes) {
    // Sort supertypes by convention
    const sorted = [...attrs.supertypes].sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.toLowerCase());
      const bi = TYPE_ORDER.indexOf(b.toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    parts.push(...sorted.map(s => s.charAt(0).toUpperCase() + s.slice(1)));
  }

  if (attrs.types && attrs.types.length > 0) {
    // Sort types by convention (Artifact Creature, not Creature Artifact)
    const sorted = [...attrs.types].sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.toLowerCase());
      const bi = TYPE_ORDER.indexOf(b.toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    parts.push(...sorted.map(t => t.charAt(0).toUpperCase() + t.slice(1)));
  } else {
    parts.push("???");
  }

  let line = parts.join(" ");

  if (attrs.subtypes && attrs.subtypes.length > 0) {
    line += " — " + attrs.subtypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }

  return line;
}

function buildManaCost(attrs: CardAttributes): string {
  // Lands don't have mana costs
  if (attrs.types?.some(t => t.toLowerCase() === "land")) return "";
  if (attrs.manaCost) return attrs.manaCost;
  if (attrs.cmc !== null) return `CMC ${attrs.cmc}`;
  return "?";
}

function buildTextBox(attrs: CardAttributes): string[] {
  const lines: string[] = [];

  if (attrs.keywords && attrs.keywords.length > 0) {
    lines.push(attrs.keywords.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", "));
  }

  if (attrs.abilities && attrs.abilities.length > 0) {
    for (const ability of attrs.abilities) {
      lines.push(ability.charAt(0).toUpperCase() + ability.slice(1));
    }
  }

  return lines;
}

export default function CardVisual({
  attributes,
  revealedName,
  revealedArt,
}: CardVisualProps) {
  // Use colorIdentity for frame color if colors is empty (e.g., lands)
  const displayColors = (attributes.colors && attributes.colors.length > 0)
    ? attributes.colors
    : attributes.colorIdentity;
  const frameColor = getFrameColor(displayColors);
  const textColor = getTextColor(displayColors);
  const typeLine = buildTypeLine(attributes);
  const manaCost = buildManaCost(attributes);
  const textBox = buildTextBox(attributes);
  const isCreature = attributes.types === null
    ? null  // unknown
    : attributes.types.some(t => t.toLowerCase() === "creature");
  const hasPT = attributes.power !== null || attributes.toughness !== null;
  const showPT = hasPT || isCreature === true || isCreature === null;

  return (
    <div
      className={`bg-gradient-to-b ${frameColor} rounded-xl border-2 border-gray-600 overflow-hidden shadow-lg`}
      style={{ aspectRatio: "63/88", width: "100%", maxWidth: "200px" }}
    >
      {/* Name bar + mana cost */}
      <div className={`flex justify-between items-center px-2 py-1 ${textColor}`}>
        <span className="text-xs font-bold truncate">
          {revealedName || "???"}
        </span>
        <span className="text-xs font-mono shrink-0 ml-1">
          {manaCost}
        </span>
      </div>

      {/* Art area */}
      <div className="mx-1.5 bg-gray-900 flex items-center justify-center" style={{ aspectRatio: "4/3" }}>
        {revealedArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={revealedArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl text-gray-600">?</span>
        )}
      </div>

      {/* Type line */}
      <div className={`px-2 py-0.5 ${textColor}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] truncate">{typeLine}</span>
          <span className={`w-2 h-2 rounded-full shrink-0 ml-1 ${getRarityColor(attributes.rarity)}`} />
        </div>
      </div>

      {/* Text box */}
      <div className="mx-1.5 mb-1 bg-gray-900/40 rounded p-1.5 min-h-[40px]">
        {textBox.length > 0 ? (
          <div className="space-y-0.5">
            {textBox.map((line, i) => (
              <p key={i} className={`text-[9px] ${textColor} opacity-90`}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-gray-500 italic">Abilities unknown</p>
        )}
      </div>

      {/* Power/Toughness */}
      {showPT && (
        <div className={`flex justify-end px-2 pb-1 ${textColor}`}>
          <span className="text-xs font-bold">
            {attributes.power ?? "?"}/{attributes.toughness ?? "?"}
          </span>
        </div>
      )}
    </div>
  );
}

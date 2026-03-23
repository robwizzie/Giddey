import { Player, Position, Tier } from "./types";
import nbaPlayersData from "@/data/nba-players.json";
import { TEAMS } from "./teams";

// ═══════════════════════════════════════════════════════════════
//  TIER THRESHOLDS
// ═══════════════════════════════════════════════════════════════
//  Dark Matter:  99-100    Galaxy Opal:  97-98
//  Pink Diamond: 95-96     Diamond:      92-94
//  Amethyst:     90-91     Ruby:         87-89
//  Sapphire:     84-86     Emerald:      80-83
//  Gold:         ≤79
// ═══════════════════════════════════════════════════════════════
export function tierFromOverall(ovr: number): Tier {
  if (ovr >= 99) return "dark-matter";
  if (ovr >= 97) return "galaxy-opal";
  if (ovr >= 95) return "pink-diamond";
  if (ovr >= 92) return "diamond";
  if (ovr >= 90) return "amethyst";
  if (ovr >= 87) return "ruby";
  if (ovr >= 84) return "sapphire";
  if (ovr >= 80) return "emerald";
  return "gold";
}

// ═══════════════════════════════════════════════════════════════
//  POSITION HELPERS
// ═══════════════════════════════════════════════════════════════
const POS_MAP: Record<string, Position> = { PG: "PG", SG: "SG", SF: "SF", PF: "PF", C: "C" };
const DEFAULT_SECONDARY: Record<Position, Position> = {
  PG: "SG",
  SG: "SF",
  SF: "PF",
  PF: "SF",
  C: "PF",
};

// Team name → abbreviation lookup
const TEAM_NAME_TO_ABBR: Record<string, string> = {};
for (const t of TEAMS) {
  TEAM_NAME_TO_ABBR[`${t.city} ${t.name}`] = t.abbreviation;
}

function makeId(firstName: string, lastName: string): string {
  return firstName.toLowerCase().replace(/['.]/g, "").replace(/\s+/g, "_") + "_" + lastName.toLowerCase().replace(/['.]/g, "").replace(/\s+/g, "_").replace(/-/g, "_");
}

// ═══════════════════════════════════════════════════════════════
//  LOAD NBA PLAYERS FROM JSON DATA
//  Data sourced from 2kratings.com. To refresh:
//  1. Get updated data from 2kratings.com
//  2. Replace src/data/nba-players.json
//  Format: [{ first_name, last_name, position, rating, team_name,
//             team_division, draft_year, image, team_logo }]
// ═══════════════════════════════════════════════════════════════
interface RawPlayer {
  first_name: string;
  last_name: string;
  position: string;
  rating: number;
  team_name: string;
  team_division: string;
  draft_year: number;
  image: string;
  team_logo: string;
}

const OVR_OVERRIDES: Record<string, number> = {
  shai_gilgeous_alexander: 100,
  nikola_jokic: 100,
  victor_wembanyama: 100,
  stephen_curry: 100,
  lebron_james: 100,
  kevin_durant: 100,
  luka_doncic: 100,
  anthony_edwards: 98,
  cade_cunningham: 97,
};

function convertRawPlayer(raw: RawPlayer): Player {
  const parts = raw.position.split("/").map((s) => s.trim());
  const primary = POS_MAP[parts[0]] ?? "SF";
  let secondary = parts[1] ? POS_MAP[parts[1]] : undefined;
  if (!secondary || secondary === primary) secondary = DEFAULT_SECONDARY[primary];

  const id = makeId(raw.first_name, raw.last_name);
  const ovr = OVR_OVERRIDES[id] ?? raw.rating;

  return {
    id,
    firstName: raw.first_name,
    lastName: raw.last_name,
    position: primary,
    secondaryPosition: secondary,
    teamId: TEAM_NAME_TO_ABBR[raw.team_name] ?? "UTA",
    draftYear: raw.draft_year,
    tier: tierFromOverall(ovr),
    overall: ovr,
  };
}

// Convert JSON data to Player objects (deduped by id)
const seen = new Set<string>();
export const PLAYERS: Player[] = [];
for (const raw of nbaPlayersData as RawPlayer[]) {
  const p = convertRawPlayer(raw);
  if (!seen.has(p.id)) {
    seen.add(p.id);
    PLAYERS.push(p);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CUSTOM / PROMO CARDS
// ═══════════════════════════════════════════════════════════════
// Add special edition cards here. Use `playerId` to link to the
// base player so two versions can't appear in the same draft.
//
// Example:
//   {
//     id: 'lebron_xmas', playerId: 'lebron_james',
//     firstName: 'LeBron', lastName: 'James', position: 'SF',
//     secondaryPosition: 'PF', teamId: 'LAL', draftYear: 2003,
//     tier: 'dark-matter', overall: 100, badge: 'CHRISTMAS',
//   },
//
export const CUSTOM_CARDS: Player[] = [
  {
    id: "hoodie_melo",
    playerId: "carmelo_anthony",
    firstName: "Carmelo",
    lastName: "Anthony",
    position: "SF",
    secondaryPosition: "PF",
    teamId: "NYK",
    draftYear: 2025,
    tier: "dark-matter",
    overall: 100,
    badge: "HOODIE",
  },
];

// All cards available for drafting (base roster + custom)
export const ALL_PLAYERS: Player[] = [...PLAYERS, ...CUSTOM_CARDS];

export function getPlayersByTier(tier: Tier): Player[] {
  return ALL_PLAYERS.filter((p) => p.tier === tier);
}

export function getPlayersByPosition(position: Position): Player[] {
  return ALL_PLAYERS.filter((p) => p.position === position);
}

export function getPlayersByTeam(teamId: string): Player[] {
  return ALL_PLAYERS.filter((p) => p.teamId === teamId);
}

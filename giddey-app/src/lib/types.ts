export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type GridPosition = Position | 'UTIL';

export type Tier = 'dark-matter' | 'galaxy-opal' | 'pink-diamond' | 'diamond' | 'amethyst' | 'ruby' | 'sapphire' | 'emerald' | 'gold';

export type Conference = 'Eastern' | 'Western';

export type Division =
  | 'Atlantic'
  | 'Central'
  | 'Southeast'
  | 'Northwest'
  | 'Pacific'
  | 'Southwest';

export interface Team {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: Conference;
  division: Division;
  primaryColor: string;
  secondaryColor: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  teamId: string;
  draftYear: number;
  tier: Tier;
  overall: number;
}

export interface PlayerCard extends Player {
  team: Team;
}

export interface GridSlot {
  index: number;
  position: GridPosition;
  label: string;
  card: PlayerCard | null;
}

export type ChemLineLevel = 'green' | 'yellow' | 'red';
export type ChemDotLevel = 'green' | 'yellow' | 'red';

export interface ChemLine {
  from: number;
  to: number;
  level: ChemLineLevel;
  points: number;
  reasons: string[]; // e.g. ['team', 'division', 'year']
}

export interface ChemDot {
  slotIndex: number;
  level: ChemDotLevel;
  points: number;
  lineChem: number;
}

export interface ScoreBreakdown {
  talent: number;
  lineChem: number;
  dotChem: number;
  totalChem: number;
  total: number;
  lines: ChemLine[];
  dots: ChemDot[];
}

export const TIER_CONFIG: Record<Tier, { label: string; color: string; borderColor: string }> = {
  'dark-matter': { label: 'Dark Matter', color: '#8b5cf6', borderColor: 'rgba(138,43,226,0.8)' },
  'galaxy-opal': { label: 'Galaxy Opal', color: '#f0abfc', borderColor: 'rgba(240,171,252,0.8)' },
  'pink-diamond': { label: 'Pink Diamond', color: '#ec4899', borderColor: 'rgba(255,105,180,0.7)' },
  'diamond': { label: 'Diamond', color: '#22d3ee', borderColor: 'rgba(0,191,255,0.7)' },
  'amethyst': { label: 'Amethyst', color: '#a855f7', borderColor: 'rgba(155,89,182,0.7)' },
  'ruby': { label: 'Ruby', color: '#ef4444', borderColor: 'rgba(231,76,60,0.7)' },
  'sapphire': { label: 'Sapphire', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.7)' },
  'emerald': { label: 'Emerald', color: '#22c55e', borderColor: 'rgba(34,197,94,0.7)' },
  'gold': { label: 'Gold', color: '#eab308', borderColor: 'rgba(234,179,8,0.7)' },
};

/*
 * Grid Formation Layout (matches Griddy's football formation but for basketball)
 *
 *        [0:SG]    [1:SF]           ← Perimeter shooters
 *   [2:UTIL] [3:PG]  [4:PG] [5:UTIL] ← Playmakers + flex
 *   [6:SF]                  [7:SG]  ← Wings
 *              [8:C]                ← Center (the bridge)
 *
 * 13 adjacencies, max chem = 13×2 + 9×11 = 125
 */
export const GRID_POSITIONS: GridPosition[] = [
  'SG', 'SF',           // Row 0: top pair
  'UTIL', 'PG', 'PG', 'UTIL', // Row 1: middle quad
  'SF', 'SG',           // Row 2: lower pair
  'C',                   // Row 3: bottom center
];

export const GRID_LABELS: string[] = [
  'SG', 'SF',
  'UTIL', 'PG', 'PG', 'UTIL',
  'SF', 'SG',
  'C',
];

// 13 adjacencies matching the formation connections
export const ADJACENCIES: [number, number][] = [
  [0, 2], [0, 3],       // SG top connects to UTIL-left and PG-left
  [1, 4], [1, 5],       // SF top connects to PG-right and UTIL-right
  [2, 3],               // UTIL-left to PG-left
  [3, 4],               // PG-left to PG-right
  [4, 5],               // PG-right to UTIL-right
  [2, 6],               // UTIL-left down to SF-bottom
  [5, 7],               // UTIL-right down to SG-bottom
  [3, 8], [4, 8],       // Both PGs to Center
  [6, 8], [7, 8],       // Both bottom wings to Center
];

// Pixel positions for each slot in the formation (within a 460×610 container)
// Card dimensions: 90w × 118h
export const CARD_W = 90;
export const CARD_H = 118;
export const GRID_CONTAINER_W = 490;
export const GRID_CONTAINER_H = 640;

export const SLOT_POSITIONS: { x: number; y: number }[] = [
  // Row 0: top pair (centered, inset from edges)
  { x: 145, y: 28 },   // 0: SG
  { x: 255, y: 28 },   // 1: SF
  // Row 1: middle quad (evenly spaced with padding)
  { x: 42, y: 175 },   // 2: UTIL
  { x: 148, y: 175 },  // 3: PG
  { x: 252, y: 175 },  // 4: PG
  { x: 358, y: 175 },  // 5: UTIL
  // Row 2: lower pair (wide but inset)
  { x: 42, y: 325 },   // 6: SF
  { x: 358, y: 325 },  // 7: SG
  // Row 3: bottom center (with room for dot below)
  { x: 200, y: 482 },  // 8: C
];

export const DRAFT_ODDS: Record<number, Record<Tier, number>> = {
  1: { 'dark-matter': 1, 'galaxy-opal': 5, 'pink-diamond': 55, 'diamond': 30, 'amethyst': 9, 'ruby': 0, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  2: { 'dark-matter': 1, 'galaxy-opal': 4, 'pink-diamond': 30, 'diamond': 45, 'amethyst': 18, 'ruby': 2, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  3: { 'dark-matter': 1, 'galaxy-opal': 3, 'pink-diamond': 10, 'diamond': 40, 'amethyst': 36, 'ruby': 10, 'sapphire': 0, 'emerald': 0, 'gold': 0 },
  4: { 'dark-matter': 1, 'galaxy-opal': 2, 'pink-diamond': 6, 'diamond': 20, 'amethyst': 40, 'ruby': 25, 'sapphire': 6, 'emerald': 0, 'gold': 0 },
  5: { 'dark-matter': 1, 'galaxy-opal': 2, 'pink-diamond': 5, 'diamond': 12, 'amethyst': 30, 'ruby': 35, 'sapphire': 12, 'emerald': 3, 'gold': 0 },
  6: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 3, 'diamond': 8, 'amethyst': 20, 'ruby': 35, 'sapphire': 22, 'emerald': 8, 'gold': 2 },
  7: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 2, 'diamond': 5, 'amethyst': 12, 'ruby': 30, 'sapphire': 28, 'emerald': 16, 'gold': 5 },
  8: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 2, 'diamond': 4, 'amethyst': 8, 'ruby': 20, 'sapphire': 30, 'emerald': 25, 'gold': 9 },
  9: { 'dark-matter': 1, 'galaxy-opal': 1, 'pink-diamond': 1, 'diamond': 3, 'amethyst': 6, 'ruby': 15, 'sapphire': 28, 'emerald': 30, 'gold': 15 },
};
